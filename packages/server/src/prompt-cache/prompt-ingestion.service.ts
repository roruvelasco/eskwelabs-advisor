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
import type { PromptSnapshotsRepository } from './prompt-snapshots.repository';
import type { PromptSnapshotRow } from './prompt-snapshots.schema';

const PROMPT_CONTEXT_TTL_SECONDS = 300;

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export type PromptRefreshResult = {
  advisorPrompts: Array<{
    advisorId: string;
    status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
    revision?: string;
    hash?: string;
    code?: string;
  }>;
  dnaDigest: {
    status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
    revision?: string;
    hash?: string;
    code?: string;
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
    private telemetryService?: TelemetryService
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
      hash
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
    if (!this.env.GOOGLE_DOCS_DNA_DOC_ID) {
      throw new HttpException(
        503,
        'DNA document is not configured',
        'dna_doc_not_configured'
      );
    }

    const document = await this.fetchDocument(this.env.GOOGLE_DOCS_DNA_DOC_ID, {
      documentType: 'dna_digest'
    });
    const sourceHash = sha256(document.text);
    const active = await this.dnaDigestsRepository.findActive();

    if (
      active &&
      active.docId === this.env.GOOGLE_DOCS_DNA_DOC_ID &&
      active.revision === document.revision &&
      active.sourceHash === sourceHash
    ) {
      await this.cacheDna(active);
      await this.recordTelemetry('dna_digest_skipped_unchanged', 'info', {
        docId: this.env.GOOGLE_DOCS_DNA_DOC_ID,
        revision: document.revision,
        sourceHash,
        digestHash: active.hash
      });
      return { digest: active, status: 'unchanged' as const };
    }

    const digestText = await this.dnaDigestSummarizer.summarize(document.text);
    const hash = sha256(digestText);
    const digest = await this.dnaDigestsRepository.createActive({
      docId: this.env.GOOGLE_DOCS_DNA_DOC_ID,
      revision: document.revision,
      sourceHash,
      digestText,
      hash
    });

    await this.cacheDna(digest);
    await this.recordTelemetry('dna_digest_regenerated', 'info', {
      docId: this.env.GOOGLE_DOCS_DNA_DOC_ID,
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
          code: this.errorCode(error)
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
        code: this.errorCode(error)
      };
    }

    return { advisorPrompts, dnaDigest };
  }
}
