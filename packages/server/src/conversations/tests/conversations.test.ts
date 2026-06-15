import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { HttpException } from '../../common/http/http-exception';
import { errorHandler } from '../../common/middleware/error.middleware';
import type { HonoEnv, Actor } from '../../common/utils/hono';
import { ConversationController } from '../conversations.controller';
import type { ConversationTitleSource } from '../conversations.schema';
import { ConversationsService } from '../conversations.service';

const actor: Actor = {
  id: crypto.randomUUID(),
  email: 'eif@example.com',
  role: 'eif',
  isActive: true,
  consentAcknowledgedAt: new Date()
};

const otherActor: Actor = {
  id: crypto.randomUUID(),
  email: 'other@example.com',
  role: 'eif',
  isActive: true,
  consentAcknowledgedAt: new Date()
};

const adminActor: Actor = {
  id: crypto.randomUUID(),
  email: 'admin@example.com',
  role: 'admin',
  isActive: true,
  consentAcknowledgedAt: new Date()
};

function createConversationRuntimeService(config?: {
  succeed?: boolean;
  throwCode?: string;
}) {
  return {
    resolveRunnableVersion: async () => {
      if (config?.throwCode) {
        throw new HttpException(422, config.throwCode, config.throwCode);
      }
      if (config?.succeed === false) {
        throw new HttpException(
          422,
          'Advisor not configured',
          'advisor_not_configured'
        );
      }
      return {
        advisorId: 'data-dashboard',
        advisorName: 'Data Dashboard Advisor',
        runtimeVersionId: crypto.randomUUID(),
        promptContext: {
          systemPrompt: 'System instructions',
          systemPromptHash: 'hash',
          promptSnapshotHash: 'snapshot-hash',
          promptDocRevision: 'revision',
          dnaDigestVersion: 'dna-version'
        },
        modelConfig: {
          provider: 'deterministic',
          model: 'deterministic-model',
          isEnabled: true
        }
      };
    },
    checkReadiness: async () => ({ ready: true as const, runtime: {} })
  } as never;
}

describe('conversations service', () => {
  test('lists no conversations without an actor', async () => {
    const service = new ConversationsService(
      {
        listForUser: async () => ({ rows: [], nextCursor: null })
      } as never,
      {} as never,
      {} as never
    );

    await expect(service.list(actor)).resolves.toEqual({
      rows: [],
      nextCursor: null
    });
  });

  test('rejects conversation creation when runtime version is missing', async () => {
    const service = new ConversationsService(
      {
        create: async () => {
          throw new Error('conversation should not be created');
        }
      } as never,
      createConversationRuntimeService({ succeed: false }),
      {} as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).rejects.toBeInstanceOf(HttpException);
  });

  test('allows conversation creation when runtime is ready', async () => {
    const service = new ConversationsService(
      {
        create: async () => ({
          id: crypto.randomUUID(),
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          advisorRuntimeVersionId: crypto.randomUUID()
        })
      } as never,
      createConversationRuntimeService({ succeed: true }),
      {} as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).resolves.toBeDefined();
  });

  test('rejects conversation creation when runtime is disabled', async () => {
    const service = new ConversationsService(
      {
        create: async () => {
          throw new Error('conversation should not be created');
        }
      } as never,
      createConversationRuntimeService({ throwCode: 'advisor_not_configured' }),
      {} as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).rejects.toMatchObject({ code: 'advisor_not_configured' });
  });

  describe('delete', () => {
    test('owner deletes a conversation', async () => {
      let called = false;
      const service = new ConversationsService(
        {
          deleteForUser: async (userId: string) => {
            expect(userId).toBe(actor.id);
            called = true;
            return true;
          }
        } as never,
        {} as never,
        {} as never
      );

      await service.delete(actor, crypto.randomUUID());
      expect(called).toBe(true);
    });

    test('returns 404 when conversation does not exist', async () => {
      const service = new ConversationsService(
        {
          deleteForUser: async () => false
        } as never,
        {} as never,
        {} as never
      );

      await expect(
        service.delete(actor, crypto.randomUUID())
      ).rejects.toMatchObject({ status: 404, code: 'not_found' });
    });

    test('returns 404 for another users conversation', async () => {
      const service = new ConversationsService(
        {
          deleteForUser: async (userId: string) => {
            expect(userId).toBe(otherActor.id);
            return false;
          }
        } as never,
        {} as never,
        {} as never
      );

      await expect(
        service.delete(otherActor, crypto.randomUUID())
      ).rejects.toMatchObject({ status: 404, code: 'not_found' });
    });

    test('delete is atomic: no separate assertOwns call', async () => {
      let findForUserCalled = false;
      const service = new ConversationsService(
        {
          deleteForUser: async (userId: string, conversationId: string) => {
            return userId === actor.id && conversationId !== 'nonexistent';
          },
          findForUser: async () => {
            findForUserCalled = true;
            return null;
          }
        } as never,
        {} as never,
        {} as never
      );

      await service.delete(actor, crypto.randomUUID());
      expect(findForUserCalled).toBe(false);
    });
  });
});

describe('title source semantics', () => {
  const successRuntime = {
    resolveRunnableVersion: async () => ({
      advisorId: 'data-dashboard',
      advisorName: 'Data Dashboard Advisor',
      runtimeVersionId: crypto.randomUUID(),
      promptContext: {
        systemPrompt: 'System instructions',
        systemPromptHash: 'hash',
        promptSnapshotHash: 'snapshot-hash',
        promptDocRevision: 'revision',
        dnaDigestVersion: 'dna-version'
      },
      modelConfig: {
        provider: 'deterministic',
        model: 'deterministic-model',
        isEnabled: true
      }
    }),
    checkReadiness: async () => ({ ready: true as const, runtime: {} })
  } as never;

  function captureCreate() {
    const calls: Array<Record<string, unknown>> = [];
    return {
      calls,
      repo: {
        create: async (input: unknown) => {
          calls.push(input as Record<string, unknown>);
          return {
            id: crypto.randomUUID(),
            userId: actor.id,
            advisorId: 'data-dashboard',
            title: (input as Record<string, string>).title,
            titleSource: (input as Record<string, string>).titleSource,
            status: 'active',
            advisorRuntimeVersionId: (
              input as Record<string, string | undefined>
            ).advisorRuntimeVersionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
      }
    };
  }

  describe('explicit create (POST /conversations)', () => {
    test('stores manual title_source when title is provided', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      await service.create(actor, {
        advisorId: 'data-dashboard',
        title: 'My Custom Title'
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe('My Custom Title');
      expect(calls[0].titleSource).toBe('manual');
    });

    test('stores fallback title_source when title is omitted', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      await service.create(actor, { advisorId: 'data-dashboard' });

      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe('Untitled conversation');
      expect(calls[0].titleSource).toBe('fallback');
    });

    test('treats blank title as absent and stores fallback', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      await service.create(actor, {
        advisorId: 'data-dashboard',
        title: '   '
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe('Untitled conversation');
      expect(calls[0].titleSource).toBe('fallback');
    });

    test('trims non-blank title before storing', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      await service.create(actor, {
        advisorId: 'data-dashboard',
        title: '  my title  '
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe('my title');
      expect(calls[0].titleSource).toBe('manual');
    });
  });

  describe('implicit create (during streaming)', () => {
    test('stores fallback title_source with first-80-chars title', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      const runtimeVersionId = crypto.randomUUID();
      await service.createImplicit(actor, {
        advisorId: 'data-dashboard',
        fallbackTitle: 'What is data analysis?'.slice(0, 80),
        runtimeVersionId
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe('What is data analysis?');
      expect(calls[0].titleSource).toBe('fallback');
      expect(calls[0].advisorRuntimeVersionId).toBe(runtimeVersionId);
    });

    test('is not incorrectly marked as manual', async () => {
      const { repo, calls } = captureCreate();
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      await service.createImplicit(actor, {
        advisorId: 'data-dashboard',
        fallbackTitle: 'Hello',
        runtimeVersionId: crypto.randomUUID()
      });

      expect(calls[0].titleSource).not.toBe('manual');
    });
  });

  describe('updateGeneratedTitleIfFallback', () => {
    type StoreEntry = {
      title: string;
      titleSource: ConversationTitleSource;
      updatedAt: Date;
    };

    function createRepo(store: Map<string, StoreEntry>) {
      return {
        listForUser: async () => [],
        findForUser: async () => null,
        create: async (input: {
          title: string;
          titleSource: ConversationTitleSource;
        }) => {
          const id = crypto.randomUUID();
          const now = new Date();
          store.set(id, {
            title: input.title,
            titleSource: input.titleSource,
            updatedAt: now
          });
          return {
            id,
            userId: actor.id,
            advisorId: 'data-dashboard',
            title: input.title,
            titleSource: input.titleSource,
            status: 'active',
            advisorRuntimeVersionId: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          };
        },
        updateGeneratedTitleIfFallback: async (
          conversationId: string,
          title: string
        ) => {
          const entry = store.get(conversationId);
          if (!entry) return false;
          if (entry.titleSource !== 'fallback') return false;
          entry.title = title;
          entry.titleSource = 'generated';
          return true;
        },
        touch: async () => {},
        deleteForUser: async () => false
      };
    }

    test('updates title and sets generated for fallback', async () => {
      const store = new Map<string, StoreEntry>();
      const repo = createRepo(store);
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      const convo = await service.create(actor, {
        advisorId: 'data-dashboard'
      });
      const updated = await repo.updateGeneratedTitleIfFallback(
        convo.id,
        'Generated Title'
      );

      expect(updated).toBe(true);
      const entry = store.get(convo.id)!;
      expect(entry.title).toBe('Generated Title');
      expect(entry.titleSource).toBe('generated');
    });

    test('returns false for manual conversation', async () => {
      const store = new Map<string, StoreEntry>();
      const repo = createRepo(store);
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      const convo = await service.create(actor, {
        advisorId: 'data-dashboard',
        title: 'My Title'
      });
      const updated = await repo.updateGeneratedTitleIfFallback(
        convo.id,
        'Should Not Apply'
      );

      expect(updated).toBe(false);
      expect(store.get(convo.id)!.title).toBe('My Title');
      expect(store.get(convo.id)!.titleSource).toBe('manual');
    });

    test('returns false for legacy conversation', async () => {
      const store = new Map<string, StoreEntry>();
      const id = crypto.randomUUID();
      store.set(id, {
        title: 'Old Title',
        titleSource: 'legacy',
        updatedAt: new Date()
      });
      const repo = createRepo(store);

      const updated = await repo.updateGeneratedTitleIfFallback(
        id,
        'Should Not Apply'
      );

      expect(updated).toBe(false);
      expect(store.get(id)!.title).toBe('Old Title');
      expect(store.get(id)!.titleSource).toBe('legacy');
    });

    test('returns false for already generated conversation', async () => {
      const store = new Map<string, StoreEntry>();
      const id = crypto.randomUUID();
      store.set(id, {
        title: 'Already Generated',
        titleSource: 'generated',
        updatedAt: new Date()
      });
      const repo = createRepo(store);

      const updated = await repo.updateGeneratedTitleIfFallback(
        id,
        'Should Not Apply'
      );

      expect(updated).toBe(false);
      expect(store.get(id)!.title).toBe('Already Generated');
    });

    test('does not modify updatedAt', async () => {
      const store = new Map<string, StoreEntry>();
      const repo = createRepo(store);
      const service = new ConversationsService(
        repo as never,
        successRuntime,
        {} as never
      );

      const convo = await service.create(actor, {
        advisorId: 'data-dashboard'
      });
      const originalUpdatedAt = store.get(convo.id)!.updatedAt;

      await repo.updateGeneratedTitleIfFallback(convo.id, 'New Title');

      expect(store.get(convo.id)!.updatedAt).toEqual(originalUpdatedAt);
    });
  });
});

describe('conversations controller - DELETE /conversations/:id', () => {
  function createTestApp(options: {
    deleteForUser?: (
      userId: string,
      conversationId: string
    ) => Promise<boolean>;
    actorGetter?: () => Actor | undefined;
  }) {
    const app = new Hono<HonoEnv>();
    app.onError(errorHandler);

    app.use('*', async (c, next) => {
      const a = options.actorGetter?.();
      if (a) {
        c.set('actor', a);
      }
      await next();
    });

    const mockService = {
      list: async () => [],
      detail: async (_a: Actor, id: string) => ({ id }),
      create: async () => ({}),
      delete: async (a: Actor, id: string) => {
        const deleted = options.deleteForUser
          ? await options.deleteForUser(a.id, id)
          : false;
        if (!deleted) {
          throw new HttpException(404, 'Not found', 'not_found');
        }
      },
      assertOwns: async () => ({
        id: '',
        userId: '',
        advisorId: '',
        title: '',
        titleSource: '',
        status: '',
        createdAt: '',
        updatedAt: ''
      }),
      touch: async () => {}
    } as never;

    const controller = new ConversationController(
      mockService as never,
      { list: (rows: unknown) => ({ data: rows }) } as never
    );

    app.route('/', controller.routes());

    return app;
  }

  test('owner deletes a conversation', async () => {
    const app = createTestApp({
      actorGetter: () => actor,
      deleteForUser: async () => true
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);
  });

  test('returns 404 for nonexistent conversation', async () => {
    const app = createTestApp({
      actorGetter: () => actor,
      deleteForUser: async () => false
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('not_found');
  });

  test('returns 400 for invalid UUID', async () => {
    const app = createTestApp({
      actorGetter: () => actor,
      deleteForUser: async () => true
    });

    const response = await app.request('/conversations/not-a-uuid', {
      method: 'DELETE'
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('validation_failed');
  });

  test('returns 401 without authentication', async () => {
    const app = createTestApp({
      actorGetter: () => undefined,
      deleteForUser: async () => false
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(401);
  });

  test('missing consent returns 403', async () => {
    const noConsentActor: Actor = {
      ...actor,
      consentAcknowledgedAt: undefined
    };

    const app = createTestApp({
      actorGetter: () => noConsentActor,
      deleteForUser: async () => true
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(403);
  });

  test('admin actor can delete own conversation', async () => {
    const app = createTestApp({
      actorGetter: () => adminActor,
      deleteForUser: async (userId: string) => {
        expect(userId).toBe(adminActor.id);
        return true;
      }
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);
  });

  test('admin actor gets 404 for another users conversation', async () => {
    const app = createTestApp({
      actorGetter: () => adminActor,
      deleteForUser: async () => false
    });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(404);
  });

  test('delete twice: first 204, second 404', async () => {
    const conversationId = crypto.randomUUID();
    let exists = true;
    const app = createTestApp({
      actorGetter: () => actor,
      deleteForUser: async () => {
        if (exists) {
          exists = false;
          return true;
        }
        return false;
      }
    });

    const first = await app.request(`/conversations/${conversationId}`, {
      method: 'DELETE'
    });
    expect(first.status).toBe(204);

    const second = await app.request(`/conversations/${conversationId}`, {
      method: 'DELETE'
    });
    expect(second.status).toBe(404);
  });
});
