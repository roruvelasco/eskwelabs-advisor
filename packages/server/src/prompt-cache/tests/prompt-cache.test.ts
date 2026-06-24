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

  test('admin refresh records admin_cache_refresh telemetry', async () => {
    let lastEvent = '';
    const service = new PromptCacheService(
      { list: async () => [], upsert: async () => {} } as never,
      {} as never,
      {
        refreshAll: async () => ({
          advisorPrompts: [
            {
              advisorId: 'data-dashboard',
              status: 'refreshed',
              revision: 'rev-1',
              hash: 'hash-1'
            }
          ],
          dnaDigest: {
            status: 'refreshed',
            revision: 'dna-rev',
            hash: 'dna-hash'
          }
        })
      } as never,
      undefined,
      undefined,
      {
        record: async (eventName: string) => {
          lastEvent = eventName;
        }
      } as never
    );

    await service.refresh('actor-1', 'admin');
    expect(lastEvent).toBe('admin_cache_refresh');
  });

  test('cron refresh records cron_cache_refresh telemetry', async () => {
    let lastEvent = '';
    const service = new PromptCacheService(
      { list: async () => [], upsert: async () => {} } as never,
      {} as never,
      {
        refreshAll: async () => ({
          advisorPrompts: [
            {
              advisorId: 'data-dashboard',
              status: 'refreshed',
              revision: 'rev-1',
              hash: 'hash-1'
            }
          ],
          dnaDigest: {
            status: 'refreshed',
            revision: 'dna-rev',
            hash: 'dna-hash'
          }
        })
      } as never,
      undefined,
      undefined,
      {
        record: async (eventName: string) => {
          lastEvent = eventName;
        }
      } as never
    );

    await service.refresh(undefined, 'cron');
    expect(lastEvent).toBe('cron_cache_refresh');
  });

  test('failure paths use source-prefixed _cache_refresh_failed event', async () => {
    let lastEvent = '';
    let lastSeverity = '';
    const service = new PromptCacheService(
      { list: async () => [], upsert: async () => {} } as never,
      {} as never,
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
            status: 'refreshed',
            revision: 'dna-rev',
            hash: 'dna-hash'
          }
        })
      } as never,
      undefined,
      undefined,
      {
        record: async (
          eventName: string,
          _actorId: string | undefined,
          severity: string
        ) => {
          lastEvent = eventName;
          lastSeverity = severity;
        }
      } as never
    );

    await service.refresh('actor-1', 'admin');
    expect(lastEvent).toBe('admin_cache_refresh_failed');
    expect(lastSeverity).toBe('error');
  });

  test('ingestion-not-configured path uses source-prefixed event', async () => {
    let lastEvent = '';
    let lastSeverity = '';
    const service = new PromptCacheService(
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      {
        record: async (
          eventName: string,
          _actorId: string | undefined,
          severity: string
        ) => {
          lastEvent = eventName;
          lastSeverity = severity;
        }
      } as never
    );

    const result = await service.refresh(undefined, 'cron');
    expect(result.status).toBe('skipped');
    expect(lastEvent).toBe('cron_cache_refresh');
    expect(lastSeverity).toBe('warning');
  });
});
