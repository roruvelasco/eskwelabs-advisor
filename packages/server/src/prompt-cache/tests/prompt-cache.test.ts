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

  test('refresh leaves prompt context hot cache intact when warming fails', async () => {
    const deletedPrefixes: string[] = [];
    const service = new PromptCacheService(
      { list: async () => [] } as never,
      {
        delByPrefix: async (...prefixes: string[]) => {
          deletedPrefixes.push(...prefixes);
        }
      } as never,
      {
        refreshAll: async () => ({
          advisorPrompts: [
            {
              advisorId: 'data-dashboard',
              status: 'failed',
              code: 'docs_fetch_failed'
            }
          ],
          dnaDigest: {
            status: 'failed',
            code: 'docs_fetch_failed'
          }
        })
      } as never
    );

    await expect(service.refresh()).resolves.toMatchObject({
      status: 'partial',
      warmed: {
        advisorPrompts: [{ status: 'failed' }],
        dnaDigest: { status: 'failed' }
      }
    });
    expect(deletedPrefixes).toEqual([]);
  });
});
