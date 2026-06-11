import type { RedisService } from '../cache/redis.service';
import { HttpException } from '../common/http/http-exception';
import type { TelemetryService } from '../telemetry/telemetry.service';
import { CompiledSystemPromptBuilder } from './compiled-system-prompt.builder';
import type { DnaDigestsRepository } from './dna-digests.repository';
import type { DnaDigestRow } from './dna-digests.schema';
import type { PromptIngestionService } from './prompt-ingestion.service';
import type { PromptSnapshotsRepository } from './prompt-snapshots.repository';
import type { PromptSnapshotRow } from './prompt-snapshots.schema';

const PROMPT_CONTEXT_TTL_SECONDS = 300;

export type PreparedPromptContext = {
  systemPrompt: string;
  systemPromptHash: string;
  promptSnapshotHash: string;
  promptDocRevision: string;
  dnaDigestVersion: string;
};

export interface PromptContextLoader {
  getForAdvisor(advisorId: string): Promise<PreparedPromptContext>;
}

export class PromptContextService implements PromptContextLoader {
  constructor(
    private promptSnapshotsRepository: PromptSnapshotsRepository,
    private dnaDigestsRepository: DnaDigestsRepository,
    private redisService: RedisService,
    private compiledSystemPromptBuilder: CompiledSystemPromptBuilder,
    private telemetryService?: TelemetryService,
    private promptIngestionService?: PromptIngestionService
  ) {}

  private promptKey(advisorId: string) {
    return `prompt-context:advisor:${advisorId}`;
  }

  private async getPrompt(advisorId: string) {
    const cached = await this.redisService.get<PromptSnapshotRow>(
      this.promptKey(advisorId)
    );
    if (cached) {
      await this.recordTelemetry('prompt_cache_hit', {
        cacheKeyType: 'advisor_prompt',
        advisorId,
        hash: cached.hash,
        revision: cached.revision
      });
      return cached;
    }

    await this.recordTelemetry('prompt_cache_miss', {
      cacheKeyType: 'advisor_prompt',
      advisorId
    });

    if (this.promptIngestionService) {
      try {
        const refreshed =
          await this.promptIngestionService.ingestAdvisorPrompt(advisorId);
        await this.recordTelemetry('prompt_live_refresh', {
          cacheKeyType: 'advisor_prompt',
          advisorId,
          status: refreshed.status,
          hash: refreshed.snapshot.hash,
          revision: refreshed.snapshot.revision
        });
        return refreshed.snapshot;
      } catch (error) {
        await this.recordTelemetry('prompt_live_refresh_failed', {
          cacheKeyType: 'advisor_prompt',
          advisorId,
          code: this.errorCode(error)
        });
      }
    }

    const active = await this.promptSnapshotsRepository.findActive(advisorId);
    if (active) {
      await this.redisService.set(
        this.promptKey(advisorId),
        active,
        PROMPT_CONTEXT_TTL_SECONDS
      );
      await this.recordTelemetry('prompt_postgres_fallback', {
        cacheKeyType: 'advisor_prompt',
        advisorId,
        hash: active.hash,
        revision: active.revision
      });
      return active;
    }

    return undefined;
  }

  private async getDna() {
    const cached =
      await this.redisService.get<DnaDigestRow>('prompt-context:dna');
    if (cached) {
      await this.recordTelemetry('prompt_cache_hit', {
        cacheKeyType: 'dna_digest',
        hash: cached.hash,
        sourceHash: cached.sourceHash,
        revision: cached.revision
      });
      return cached;
    }

    await this.recordTelemetry('prompt_cache_miss', {
      cacheKeyType: 'dna_digest'
    });

    if (this.promptIngestionService) {
      try {
        const refreshed = await this.promptIngestionService.ingestDnaDigest();
        await this.recordTelemetry('prompt_live_refresh', {
          cacheKeyType: 'dna_digest',
          status: refreshed.status,
          hash: refreshed.digest.hash,
          revision: refreshed.digest.revision,
          sourceHash: refreshed.digest.sourceHash
        });
        return refreshed.digest;
      } catch (error) {
        await this.recordTelemetry('prompt_live_refresh_failed', {
          cacheKeyType: 'dna_digest',
          code: this.errorCode(error)
        });
      }
    }

    const active = await this.dnaDigestsRepository.findActive();
    if (active) {
      await this.redisService.set(
        'prompt-context:dna',
        active,
        PROMPT_CONTEXT_TTL_SECONDS
      );
      await this.recordTelemetry('prompt_postgres_fallback', {
        cacheKeyType: 'dna_digest',
        hash: active.hash,
        sourceHash: active.sourceHash,
        revision: active.revision
      });
      return active;
    }

    return undefined;
  }

  private async recordTelemetry(
    eventName: string,
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService?.record(
        eventName,
        undefined,
        'info',
        payload
      );
    } catch {
      return;
    }
  }

  private errorCode(error: unknown) {
    return error instanceof Error && 'code' in error
      ? String(error.code)
      : 'prompt_live_refresh_failed';
  }

  async getForAdvisor(advisorId: string) {
    const [prompt, dna] = await Promise.all([
      this.getPrompt(advisorId),
      this.getDna()
    ]);

    if (!prompt?.contentText || !dna?.digestText) {
      await this.recordTelemetry('prompt_context_unavailable', {
        advisorId,
        hasPrompt: Boolean(prompt?.contentText),
        hasDna: Boolean(dna?.digestText)
      });
      throw new HttpException(
        503,
        'Prompt context is unavailable',
        'prompt_context_unavailable'
      );
    }

    const compiled = this.compiledSystemPromptBuilder.build({
      advisorPromptText: prompt.contentText,
      dnaDigestText: dna.digestText
    });

    return {
      systemPrompt: compiled.text,
      systemPromptHash: compiled.hash,
      promptSnapshotHash: prompt.hash,
      promptDocRevision: prompt.revision,
      dnaDigestVersion: dna.hash
    };
  }
}

export class DeterministicPromptContextService implements PromptContextLoader {
  constructor(
    private compiledSystemPromptBuilder: CompiledSystemPromptBuilder
  ) {}

  async getForAdvisor(advisorId: string) {
    const compiled = this.compiledSystemPromptBuilder.build({
      dnaDigestText: 'DNA digest for all advisors',
      advisorPromptText: `System instructions for ${advisorId}`
    });

    return {
      systemPrompt: compiled.text,
      systemPromptHash: compiled.hash,
      promptSnapshotHash: `prompt:${advisorId}:deterministic`,
      promptDocRevision: 'deterministic-revision',
      dnaDigestVersion: 'deterministic-dna-v1'
    };
  }
}
