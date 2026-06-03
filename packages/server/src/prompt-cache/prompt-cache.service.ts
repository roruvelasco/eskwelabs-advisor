import { PromptCacheRepository } from './prompt-cache.repository';
import type { RedisService } from '../cache/redis.service';

export class PromptCacheService {
  constructor(
    private promptCacheRepository: PromptCacheRepository,
    private redisService: RedisService
  ) {}

  async list() {
    return this.promptCacheRepository.list();
  }

  async refresh() {
    await this.redisService?.delByPrefix('prompt:', 'dna:');
    return {
      status: 'refreshed',
      invalidatedPrefixes: ['prompt', 'dna']
    };
  }
}
