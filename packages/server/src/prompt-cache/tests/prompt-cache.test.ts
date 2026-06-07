import { describe, expect, test } from 'bun:test';

import { PromptCacheService } from '../prompt-cache.service';

describe('prompt cache service', () => {
  test('lists last-good cache metadata from the repository', async () => {
    const service = new PromptCacheService(
      {
        list: async () => [
          {
            key: 'prompt:data-dashboard',
            valueHash: 'deterministic',
            docRevision: 'revision-1',
            dnaDigestVersion: null,
            lastGoodAt: new Date(),
            expiresAt: new Date(),
            updatedAt: new Date()
          }
        ]
      } as never,
      {} as never
    );

    await expect(service.list()).resolves.toMatchObject([
      {
        key: 'prompt:data-dashboard',
        valueHash: 'deterministic'
      }
    ]);
  });
});
