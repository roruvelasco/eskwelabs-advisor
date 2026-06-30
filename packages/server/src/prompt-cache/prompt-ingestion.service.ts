import { createHash } from 'node:crypto';

import type {
  DnaDigestSummarizer,
  GoogleDocsClient
} from '../adapters/advisor-adapters';
import type { AdvisorsService } from '../advisors/advisors.service';
import type { RedisService } from '../cache/redis.service';
import { HttpException } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { DnaDigestsRepository } from './dna-digests.repository';
import type { DnaDigestRow } from './dna-digests.schema';
import type { DnaSourceConfigRepository } from './dna-source-config.repository';
import type { PromptSnapshotsRepository } from './prompt-snapshots.repository';
import type { PromptSnapshotRow } from './prompt-snapshots.schema';

const PROMPT_CONTEXT_TTL_SECONDS = 300;

const MIN_PROMPT_CHARS = 200;
const MAX_PROMPT_CHARS = 50000;
const PROMPT_SIZE_WARN_CHARS = 24000;
const MAX_DNA_SOURCE_CHARS = 100000;
const DNA_SOURCE_WARN_CHARS = 50000;
const MIN_DIGEST_CHARS = 50;
const MAX_DIGEST_CHARS = 20000;

const DNA_REQUIRED_CATEGORIES = [
  'eskwelabs',
  'data',
  'mentor',
  'fellow',
  'communication'
];

const DNA_DIRECTIVE_KEYWORDS = [
  'tone',
  'voice',
  'style',
  'speak',
  'talk',
  'sound',
  'persona',
  'respond',
  'answer',
  'must',
  'always',
  'never'
];

const DIRECTIVE_TERM_STOPWORDS = new Set([
  'advisor',
  'advisors',
  'answer',
  'answers',
  'brand',
  'communication',
  'data',
  'digest',
  'eskwelabs',
  'fellow',
  'fellows',
  'internal',
  'mentor',
  'mentoring',
  'prompt',
  'reply',
  'replies',
  'respond',
  'response',
  'speak',
  'style',
  'system',
  'tone',
  'user',
  'voice'
]);

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

type ValidationResult = {
  valid: boolean;
  status?: string;
  reason?: string;
};

function validatePromptText(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length < MIN_PROMPT_CHARS) {
    return {
      valid: false,
      status: 'too_short',
      reason: `Prompt text is ${trimmed.length} chars; minimum is ${MIN_PROMPT_CHARS}`
    };
  }
  if (trimmed.length > MAX_PROMPT_CHARS) {
    return {
      valid: false,
      status: 'too_long',
      reason: `Prompt text is ${trimmed.length} chars; maximum is ${MAX_PROMPT_CHARS}`
    };
  }
  return { valid: true };
}

function validateDnaSource(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length > MAX_DNA_SOURCE_CHARS) {
    return {
      valid: false,
      status: 'source_too_long',
      reason: `DNA source is ${trimmed.length} chars; maximum is ${MAX_DNA_SOURCE_CHARS}`
    };
  }
  if (!trimmed) {
    return {
      valid: false,
      status: 'source_empty',
      reason: 'DNA source document is empty'
    };
  }
  return { valid: true };
}

export function extractDnaDirectiveTerms(sourceText: string) {
  const terms = new Set<string>();
  const directiveLines = sourceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      const lower = line.toLowerCase();
      return DNA_DIRECTIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
    });

  for (const line of directiveLines) {
    const lower = line.toLowerCase();
    const likeMatches = lower.matchAll(
      /\b(?:speak|talk|sound|write|respond|answer|act)\s+(?:more\s+)?(?:like|as)\s+(?:a|an|the)?\s*([a-z][a-z-]{2,})\b/g
    );
    for (const match of likeMatches) terms.add(match[1]);

    const labelMatches = lower.matchAll(
      /\b(?:tone|voice|style|persona)\s*(?::|=|-|is|should be|must be)\s*(?:a|an|the)?\s*([a-z][a-z-]{2,})\b/g
    );
    for (const match of labelMatches) terms.add(match[1]);
  }

  return [...terms].filter((term) => !DIRECTIVE_TERM_STOPWORDS.has(term));
}

function validateDnaDigest(
  digestText: string,
  requiredDirectiveTerms: string[] = []
): ValidationResult {
  const trimmed = digestText.trim();
  if (!trimmed) {
    return {
      valid: false,
      status: 'digest_empty',
      reason: 'DNA digest is empty'
    };
  }
  if (trimmed.length < MIN_DIGEST_CHARS) {
    return {
      valid: false,
      status: 'digest_too_short',
      reason: `DNA digest is ${trimmed.length} chars; minimum is ${MIN_DIGEST_CHARS}`
    };
  }
  if (trimmed.length > MAX_DIGEST_CHARS) {
    return {
      valid: false,
      status: 'digest_too_long',
      reason: `DNA digest is ${trimmed.length} chars; maximum is ${MAX_DIGEST_CHARS}`
    };
  }
  const lowerDigest = trimmed.toLowerCase();
  const missing = DNA_REQUIRED_CATEGORIES.filter(
    (category) => !lowerDigest.includes(category)
  );
  if (missing.length > 0) {
    return {
      valid: false,
      status: 'digest_missing_categories',
      reason: `DNA digest missing required categories: ${missing.join(', ')}`
    };
  }
  const missingDirectiveTerms = requiredDirectiveTerms.filter(
    (term) => !lowerDigest.includes(term)
  );
  if (missingDirectiveTerms.length > 0) {
    return {
      valid: false,
      status: 'digest_missing_source_directives',
      reason: `DNA digest missing source directive terms: ${missingDirectiveTerms.join(', ')}`
    };
  }
  return { valid: true };
}

export type PromptRefreshResult = {
  advisorPrompts: Array<{
    advisorId: string;
    status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
    revision?: string;
    hash?: string;
    code?: string;
    reason?: string;
  }>;
  dnaDigest: {
    status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
    revision?: string;
    hash?: string;
    code?: string;
    reason?: string;
  };
};

export class PromptIngestionService {
  constructor(
    private advisorsService: AdvisorsService,
    private docsClient: GoogleDocsClient,
    private dnaDigestSummarizer: DnaDigestSummarizer,
    private promptSnapshotsRepository: PromptSnapshotsRepository,
    private dnaDigestsRepository: DnaDigestsRepository,
    private redisService: RedisService,
    private env: ServerEnv,
    private telemetryService?: TelemetryService,
    private dnaSourceConfigRepository?: DnaSourceConfigRepository
  ) {}

  private async cachePrompt(snapshot: PromptSnapshotRow) {
    await this.redisService.set(
      `prompt-context:advisor:${snapshot.advisorId}`,
      snapshot,
      PROMPT_CONTEXT_TTL_SECONDS
    );
  }

  private async cacheDna(digest: DnaDigestRow) {
    await this.redisService.set(
      'prompt-context:dna',
      digest,
      PROMPT_CONTEXT_TTL_SECONDS
    );
  }

  private errorCode(error: unknown) {
    return error instanceof Error && 'code' in error
      ? String(error.code)
      : 'prompt_ingestion_failed';
  }

  private errorReason(error: unknown) {
    return error instanceof HttpException ? error.message : undefined;
  }

  private async recordTelemetry(
    eventName: string,
    severity: 'info' | 'warning' | 'error',
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService?.record(
        eventName,
        undefined,
        severity,
        payload
      );
    } catch {
      return;
    }
  }

  private async fetchDocument(docId: string, payload: Record<string, unknown>) {
    try {
      const document = await this.docsClient.fetchDocument(docId);
      await this.recordTelemetry('google_docs_fetch', 'info', {
        ...payload,
        docId,
        revision: document.revision,
        status: 'ok'
      });
      return document;
    } catch (error) {
      const code = this.errorCode(error);
      await this.recordTelemetry('google_docs_fetch', 'error', {
        ...payload,
        docId,
        status: 'failed',
        code
      });
      await this.recordTelemetry('doc_fetch_error', 'error', {
        ...payload,
        docId,
        code
      });
      throw error;
    }
  }

  async ingestAdvisorPrompt(advisorId: string) {
    const advisor = await this.advisorsService.getActive(advisorId);
    if (!advisor.promptDocId) {
      throw new HttpException(
        422,
        'Advisor prompt is not configured',
        'advisor_prompt_not_configured'
      );
    }

    const document = await this.fetchDocument(advisor.promptDocId, {
      documentType: 'advisor_prompt',
      advisorId
    });
    const validation = validatePromptText(document.text);
    if (!validation.valid) {
      await this.recordTelemetry('prompt_validation_failed', 'warning', {
        advisorId,
        docId: advisor.promptDocId,
        revision: document.revision,
        validationStatus: validation.status,
        validationReason: validation.reason
      });
      throw new HttpException(
        422,
        validation.reason ?? 'Prompt validation failed',
        `prompt_validation_${validation.status}`
      );
    }

    if (document.text.trim().length > PROMPT_SIZE_WARN_CHARS) {
      await this.recordTelemetry('prompt_size_warning', 'warning', {
        advisorId,
        docId: advisor.promptDocId,
        revision: document.revision,
        promptChars: document.text.trim().length,
        warnThreshold: PROMPT_SIZE_WARN_CHARS
      });
    }

    const hash = sha256(document.text);
    const active = await this.promptSnapshotsRepository.findActive(advisorId);

    if (
      active &&
      active.docId === advisor.promptDocId &&
      active.revision === document.revision &&
      active.hash === hash
    ) {
      await this.cachePrompt(active);
      await this.recordTelemetry('prompt_snapshot_unchanged', 'info', {
        advisorId,
        docId: advisor.promptDocId,
        revision: document.revision,
        hash
      });
      return { snapshot: active, status: 'unchanged' as const };
    }

    const snapshot = await this.promptSnapshotsRepository.createActive({
      advisorId,
      docId: advisor.promptDocId,
      revision: document.revision,
      contentText: document.text,
      hash,
      validationStatus: 'ok',
      validationReason: null
    });

    await this.cachePrompt(snapshot);
    await this.recordTelemetry('prompt_snapshot_refreshed', 'info', {
      advisorId,
      docId: advisor.promptDocId,
      revision: snapshot.revision,
      hash: snapshot.hash
    });
    return { snapshot, status: 'refreshed' as const };
  }

  async ingestDnaDigest() {
    const configured = await this.dnaSourceConfigRepository?.find();
    const docId = configured?.docId ?? this.env.GOOGLE_DOCS_DNA_DOC_ID;

    if (!docId) {
      throw new HttpException(
        503,
        'DNA document is not configured',
        'dna_doc_not_configured'
      );
    }

    const document = await this.fetchDocument(docId, {
      documentType: 'dna_digest'
    });

    const sourceValidation = validateDnaSource(document.text);
    if (!sourceValidation.valid) {
      await this.recordTelemetry('dna_validation_failed', 'warning', {
        docId,
        revision: document.revision,
        validationStatus: sourceValidation.status,
        validationReason: sourceValidation.reason
      });
      throw new HttpException(
        422,
        sourceValidation.reason ?? 'DNA source validation failed',
        `dna_validation_${sourceValidation.status}`
      );
    }

    if (document.text.trim().length > DNA_SOURCE_WARN_CHARS) {
      await this.recordTelemetry('dna_source_size_warning', 'warning', {
        docId,
        revision: document.revision,
        sourceChars: document.text.trim().length,
        warnThreshold: DNA_SOURCE_WARN_CHARS
      });
    }

    const sourceHash = sha256(document.text);
    const requiredDirectiveTerms = extractDnaDirectiveTerms(document.text);
    const active = await this.dnaDigestsRepository.findActive();

    if (
      active &&
      active.docId === docId &&
      active.revision === document.revision &&
      active.sourceHash === sourceHash &&
      validateDnaDigest(active.digestText, requiredDirectiveTerms).valid
    ) {
      await this.cacheDna(active);
      await this.recordTelemetry('dna_digest_skipped_unchanged', 'info', {
        docId,
        revision: document.revision,
        sourceHash,
        digestHash: active.hash
      });
      return { digest: active, status: 'unchanged' as const };
    }

    const digestText = await this.dnaDigestSummarizer.summarize(document.text);

    const digestValidation = validateDnaDigest(
      digestText,
      requiredDirectiveTerms
    );
    if (!digestValidation.valid) {
      await this.recordTelemetry('dna_digest_validation_failed', 'warning', {
        docId,
        revision: document.revision,
        sourceHash,
        validationStatus: digestValidation.status,
        validationReason: digestValidation.reason
      });
      throw new HttpException(
        422,
        digestValidation.reason ?? 'DNA digest validation failed',
        `dna_digest_validation_${digestValidation.status}`
      );
    }

    const hash = sha256(digestText);
    const digest = await this.dnaDigestsRepository.createActive({
      docId,
      revision: document.revision,
      sourceHash,
      digestText,
      hash,
      validationStatus: 'ok',
      validationReason: null
    });

    await this.cacheDna(digest);
    await this.recordTelemetry('dna_digest_regenerated', 'info', {
      docId,
      revision: digest.revision,
      sourceHash: digest.sourceHash,
      digestHash: digest.hash
    });
    return { digest, status: 'refreshed' as const };
  }

  async refreshAll(): Promise<PromptRefreshResult> {
    const advisors = await this.advisorsService.list();
    const advisorPrompts = [];

    for (const advisor of advisors) {
      if (!advisor.promptDocId) {
        advisorPrompts.push({
          advisorId: advisor.id,
          status: 'skipped' as const,
          code: 'advisor_prompt_not_configured'
        });
        continue;
      }

      try {
        const result = await this.ingestAdvisorPrompt(advisor.id);
        advisorPrompts.push({
          advisorId: advisor.id,
          status: result.status,
          revision: result.snapshot.revision,
          hash: result.snapshot.hash
        });
      } catch (error) {
        advisorPrompts.push({
          advisorId: advisor.id,
          status: 'failed' as const,
          code: this.errorCode(error),
          reason: this.errorReason(error)
        });
      }
    }

    let dnaDigest: PromptRefreshResult['dnaDigest'];
    try {
      const result = await this.ingestDnaDigest();
      dnaDigest = {
        status: result.status,
        revision: result.digest.revision,
        hash: result.digest.hash
      };
    } catch (error) {
      dnaDigest = {
        status: 'failed',
        code: this.errorCode(error),
        reason: this.errorReason(error)
      };
    }

    return { advisorPrompts, dnaDigest };
  }
}
