import type { PromptCacheService } from '../prompt-cache.service';

export type RefreshSource = 'admin' | 'cron';

export class PromptContextRefreshUseCase {
  constructor(private promptCacheService: PromptCacheService) {}

  async execute(actorId?: string, source: RefreshSource = 'admin') {
    return this.promptCacheService.refresh(actorId, source);
  }
}

export class PromptRollbackUseCase {
  constructor(private promptCacheService: PromptCacheService) {}

  async activateAdvisorSnapshot(
    advisorId: string,
    snapshotId: string,
    actorId?: string
  ) {
    return this.promptCacheService.activateAdvisorSnapshot(
      advisorId,
      snapshotId,
      actorId
    );
  }

  async activateDnaDigest(digestId: string, actorId?: string) {
    return this.promptCacheService.activateDnaDigest(digestId, actorId);
  }
}
