import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { PromptCacheService } from '../prompt-cache.service';

describe('prompt cache service', () => {
  test('lists deterministic last-good cache metadata', async () => {
    const service = createContainer().get(PromptCacheService);
    await expect(service.list()).resolves.toMatchObject([
      {
        key: 'prompt:data-dashboard',
        valueHash: 'deterministic'
      }
    ]);
  });
});
