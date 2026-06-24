import { PromptCacheRepository } from './prompt-cache.repository';
import type { PaginatedResult } from '../common/pagination';
import type { PromptCacheEntry } from './prompt-cache.schema';
import type { RedisService } from '../cache/redis.service';
import { HttpException } from '../common/http/http-exception';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { DnaDigestsRepository } from './dna-digests.repository';
import type { DnaDigestRow } from './dna-digests.schema';
import type { PromptIngestionService } from './prompt-ingestion.service';
import type { PromptSnapshotsRepository } from './prompt-snapshots.repository';
import type { PromptSnapshotRow } from './prompt-snapshots.schema';
import type { RefreshSource } from './use-cases/prompt-cache-workflow.use-case';

const PROMPT_CONTEXT_TTL_SECONDS = 300;

export class PromptCacheService {
  constructor(
    private promptCacheRepository: PromptCacheRepository,
    private redisService: RedisService,
    private promptIngestionService?: PromptIngestionService,
    private promptSnapshotsRepository?: PromptSnapshotsRepository,
    private dnaDigestsRepository?: DnaDigestsRepository,
    private telemetryService?: TelemetryService
  ) {}

  async list(
    limit?: number,
    cursor?: string
  ): Promise<PaginatedResult<PromptCacheEntry>> {
    return this.promptCacheRepository.list({ limit, cursor });
  }

  async count() {
    return this.promptCacheRepository.count();
  }

  private async recordTelemetry(
    eventName: string,
    actorId: string | undefined,
    severity: 'info' | 'warning' | 'error',
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService?.record(
        eventName,
        actorId,
        severity,
        payload
      );
    } catch {
      return;
    }
  }

  private async cachePrompt(snapshot: PromptSnapshotRow) {
    const now = new Date();
    await this.redisService.set(
      `prompt-context:advisor:${snapshot.advisorId}`,
      snapshot,
      PROMPT_CONTEXT_TTL_SECONDS
    );
    await this.promptCacheRepository.upsert({
      key: `prompt-context:advisor:${snapshot.advisorId}`,
      valueHash: snapshot.hash,
      docRevision: snapshot.revision,
      dnaDigestVersion: null,
      lastGoodAt: now,
      expiresAt: new Date(now.getTime() + PROMPT_CONTEXT_TTL_SECONDS * 1000)
    });
  }

  private async cacheDna(digest: DnaDigestRow) {
    const now = new Date();
    await this.redisService.set(
      'prompt-context:dna',
      digest,
      PROMPT_CONTEXT_TTL_SECONDS
    );
    await this.promptCacheRepository.upsert({
      key: 'prompt-context:dna',
      valueHash: digest.hash,
      docRevision: digest.revision,
      dnaDigestVersion: digest.hash,
      lastGoodAt: now,
      expiresAt: new Date(now.getTime() + PROMPT_CONTEXT_TTL_SECONDS * 1000)
    });
  }

  private async recordWarmedMetadata(
    warmed: Awaited<ReturnType<PromptIngestionService['refreshAll']>>
  ) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + PROMPT_CONTEXT_TTL_SECONDS * 1000
    );

    await Promise.all([
      ...warmed.advisorPrompts
        .filter((prompt) => prompt.hash && prompt.revision)
        .map((prompt) =>
          this.promptCacheRepository.upsert({
            key: `prompt-context:advisor:${prompt.advisorId}`,
            valueHash: prompt.hash!,
            docRevision: prompt.revision!,
            dnaDigestVersion: null,
            lastGoodAt: now,
            expiresAt
          })
        ),
      warmed.dnaDigest.hash && warmed.dnaDigest.revision
        ? this.promptCacheRepository.upsert({
            key: 'prompt-context:dna',
            valueHash: warmed.dnaDigest.hash,
            docRevision: warmed.dnaDigest.revision,
            dnaDigestVersion: warmed.dnaDigest.hash,
            lastGoodAt: now,
            expiresAt
          })
        : Promise.resolve()
    ]);
  }

  async refresh(actorId?: string, source: RefreshSource = 'admin') {
    if (!this.promptIngestionService) {
      const result = { status: 'skipped' as const, warmed: null };
      await this.recordTelemetry(
        `${source}_cache_refresh`,
        actorId,
        'warning' as const,
        {
          status: result.status,
          code: 'prompt_ingestion_not_configured'
        }
      );
      return result;
    }

    const warmed = await this.promptIngestionService.refreshAll();
    await this.recordWarmedMetadata(warmed);

    const hasFailure =
      warmed.dnaDigest.status === 'failed' ||
      warmed.advisorPrompts.some((prompt) => prompt.status === 'failed');
    const result = {
      status: hasFailure ? ('partial' as const) : ('refreshed' as const),
      warmed
    };

    await this.recordTelemetry(
      hasFailure ? `${source}_cache_refresh_failed` : `${source}_cache_refresh`,
      actorId,
      hasFailure ? ('error' as const) : ('info' as const),
      {
        status: result.status,
        advisorPromptCount: warmed.advisorPrompts.length,
        failedAdvisorPromptCount: warmed.advisorPrompts.filter(
          (prompt) => prompt.status === 'failed'
        ).length,
        dnaDigestStatus: warmed.dnaDigest.status,
        dnaDigestHash: warmed.dnaDigest.hash
      }
    );

    return result;
  }

  async listAdvisorSnapshots(advisorId: string) {
    return this.promptSnapshotsRepository?.listForAdvisor(advisorId) ?? [];
  }

  async listDnaDigests() {
    return this.dnaDigestsRepository?.list() ?? [];
  }

  async activateAdvisorSnapshot(
    advisorId: string,
    snapshotId: string,
    actorId?: string
  ) {
    if (!this.promptSnapshotsRepository) {
      throw new HttpException(
        503,
        'Prompt snapshots are not configured',
        'prompt_snapshots_not_configured'
      );
    }

    const snapshot = await this.promptSnapshotsRepository.activate(
      advisorId,
      snapshotId
    );
    await this.cachePrompt(snapshot);
    await this.recordTelemetry('prompt_snapshot_rollback', actorId, 'info', {
      advisorId,
      snapshotId,
      revision: snapshot.revision,
      hash: snapshot.hash
    });
    return snapshot;
  }

  async activateDnaDigest(digestId: string, actorId?: string) {
    if (!this.dnaDigestsRepository) {
      throw new HttpException(
        503,
        'DNA digests are not configured',
        'dna_digests_not_configured'
      );
    }

    const digest = await this.dnaDigestsRepository.activate(digestId);
    await this.cacheDna(digest);
    await this.recordTelemetry('dna_digest_rollback', actorId, 'info', {
      digestId,
      revision: digest.revision,
      sourceHash: digest.sourceHash,
      digestHash: digest.hash
    });
    return digest;
  }

  async health() {
    const advisorSnapshots = this.promptSnapshotsRepository
      ? await Promise.all(
          (await this.promptSnapshotsRepository.listAllActive()).map(
            async (snapshot) => ({
              advisorId: snapshot.advisorId,
              activeSnapshot: {
                id: snapshot.id,
                hash: snapshot.hash,
                revision: snapshot.revision,
                validationStatus: snapshot.validationStatus,
                validationReason: snapshot.validationReason,
                createdAt: snapshot.createdAt.toISOString()
              }
            })
          )
        )
      : [];

    const dnaActive = this.dnaDigestsRepository
      ? await this.dnaDigestsRepository.findActive()
      : undefined;

    return {
      advisors: advisorSnapshots,
      dna: dnaActive
        ? {
            active: {
              id: dnaActive.id,
              hash: dnaActive.hash,
              sourceHash: dnaActive.sourceHash,
              revision: dnaActive.revision,
              validationStatus: dnaActive.validationStatus,
              validationReason: dnaActive.validationReason,
              createdAt: dnaActive.createdAt.toISOString()
            }
          }
        : null
    };
  }
}
