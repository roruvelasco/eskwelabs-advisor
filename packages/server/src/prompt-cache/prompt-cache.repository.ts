import { Repository } from '../common/factories/repository.factory';

export class PromptCacheRepository extends Repository {
  async list() {
    return [
      {
        key: 'prompt:data-dashboard',
        valueHash: 'deterministic',
        docRevision: 'deterministic-revision',
        dnaDigestVersion: null,
        updatedAt: new Date(0).toISOString()
      }
    ];
  }
}
