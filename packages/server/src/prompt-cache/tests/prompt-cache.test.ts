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

  test('dna source falls back to active digest metadata before database config exists', async () => {
    const service = new PromptCacheService(
      {} as never,
      {} as never,
      undefined,
      undefined,
      {
        findActive: async () => ({
          docId: 'active-dna-doc',
          createdAt: new Date('2026-01-01T00:00:00.000Z')
        })
      } as never,
      undefined,
      {
        find: async () => undefined
      } as never,
      { GOOGLE_DOCS_DNA_DOC_ID: 'env-dna-doc' } as never
    );

    await expect(service.getDnaSource()).resolves.toMatchObject({
      docId: 'active-dna-doc',
      source: 'active_digest'
    });
  });

  test('dna source update persists database config and records telemetry', async () => {
    let savedDocId = '';
    let telemetryEvent = '';
    const service = new PromptCacheService(
      {} as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      {
        record: async (eventName: string) => {
          telemetryEvent = eventName;
        }
      } as never,
      {
        upsert: async (input: { docId: string; updatedBy?: string }) => {
          savedDocId = input.docId;
          return {
            docId: input.docId,
            updatedBy: input.updatedBy,
            updatedAt: new Date('2026-01-01T00:00:00.000Z')
          };
        }
      } as never
    );

    await expect(
      service.updateDnaSource('new-dna-doc', 'admin-1')
    ).resolves.toMatchObject({
      docId: 'new-dna-doc',
      source: 'database',
      updatedBy: 'admin-1'
    });
    expect(savedDocId).toBe('new-dna-doc');
    expect(telemetryEvent).toBe('dna_source_updated');
  });
});
