import { describe, expect, test } from 'bun:test';

import { PromptCacheService } from '../prompt-cache.service';

describe('prompt cache service', () => {
  test('lists last-good cache metadata from the repository', async () => {
    const entry = {
      key: 'prompt:data-dashboard',
      valueHash: 'deterministic',
      docRevision: 'revision-1',
      dnaDigestVersion: null,
      lastGoodAt: new Date(),
      expiresAt: new Date(),
      updatedAt: new Date()
    };
    const service = new PromptCacheService(
      {
        list: async () => ({ rows: [entry], nextCursor: null })
      } as never,
      {} as never
    );

    await expect(service.list()).resolves.toMatchObject({
      rows: [
        {
          key: 'prompt:data-dashboard',
          valueHash: 'deterministic'
        }
      ],
      nextCursor: null
    });
  });

  test('refresh leaves prompt context hot cache intact when warming fails', async () => {
    const deletedPrefixes: string[] = [];
    const metadataWrites: unknown[] = [];
    const service = new PromptCacheService(
      {
        list: async () => [],
        upsert: async (input: unknown) => {
          metadataWrites.push(input);
        }
      } as never,
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
    expect(metadataWrites).toEqual([]);
  });

  test('refresh records warmed prompt and dna metadata for the admin panel', async () => {
    const metadataWrites: unknown[] = [];
    const service = new PromptCacheService(
      {
        list: async () => [],
        upsert: async (input: unknown) => {
          metadataWrites.push(input);
        }
      } as never,
      {} as never,
      {
        refreshAll: async () => ({
          advisorPrompts: [
            {
              advisorId: 'data-dashboard',
              status: 'refreshed',
              revision: 'prompt-revision',
              hash: 'prompt-hash'
            }
          ],
          dnaDigest: {
            status: 'refreshed',
            revision: 'dna-revision',
            hash: 'dna-hash'
          }
        })
      } as never
    );

    await expect(service.refresh()).resolves.toMatchObject({
      status: 'refreshed'
    });
    expect(metadataWrites).toEqual([
      expect.objectContaining({
        key: 'prompt-context:advisor:data-dashboard',
        valueHash: 'prompt-hash',
        docRevision: 'prompt-revision'
      }),
      expect.objectContaining({
        key: 'prompt-context:dna',
        valueHash: 'dna-hash',
        docRevision: 'dna-revision',
        dnaDigestVersion: 'dna-hash'
      })
    ]);
  });
});
