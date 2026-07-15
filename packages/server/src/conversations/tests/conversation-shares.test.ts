import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { errorHandler } from '../../common/middleware/error.middleware';
import type { HonoEnv, Actor } from '../../common/utils/hono';
import { ConversationSharesSerializer } from '../conversation-shares.serializer';
import { ConversationSharesService } from '../conversation-shares.service';
import { ConversationController } from '../conversations.controller';
import type { ConversationShareRow } from '../conversation-shares.repository';

const actor: Actor = {
  id: crypto.randomUUID(),
  email: 'eif@example.com',
  role: 'eif',
  isActive: true,
  consentAcknowledgedAt: new Date()
};

function shareRow(
  overrides: Partial<ConversationShareRow> = {}
): ConversationShareRow {
  return {
    id: crypto.randomUUID(),
    shareId: 'a'.repeat(43),
    conversationId: crypto.randomUUID(),
    createdBy: actor.id,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('conversation shares service - share', () => {
  test('creates a share with a long random shareId when none exists', async () => {
    const conversationId = crypto.randomUUID();
    let created: Record<string, string> | undefined;
    const service = new ConversationSharesService(
      {
        findByConversationId: async () => null,
        create: async (input: Record<string, string>) => {
          created = input;
          return shareRow({ shareId: input.shareId, conversationId });
        }
      } as never,
      {
        findForUser: async () => ({ id: conversationId })
      } as never,
      {} as never
    );

    const share = await service.share(actor, conversationId);

    expect(created).toBeDefined();
    expect(created!.createdBy).toBe(actor.id);
    expect(created!.shareId.length).toBeGreaterThanOrEqual(32);
    expect(created!.shareId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(share.shareId).toBe(created!.shareId);
  });

  test('generates a distinct shareId per share', async () => {
    const seen = new Set<string>();
    const service = new ConversationSharesService(
      {
        findByConversationId: async () => null,
        create: async (input: Record<string, string>) => {
          seen.add(input.shareId);
          return shareRow({ shareId: input.shareId });
        }
      } as never,
      { findForUser: async () => ({ id: crypto.randomUUID() }) } as never,
      {} as never
    );

    await service.share(actor, crypto.randomUUID());
    await service.share(actor, crypto.randomUUID());

    expect(seen.size).toBe(2);
  });

  test('reuses the existing active share instead of creating a duplicate', async () => {
    const existing = shareRow();
    const service = new ConversationSharesService(
      {
        findByConversationId: async () => existing,
        create: async () => {
          throw new Error('should not create a duplicate share');
        }
      } as never,
      {
        findForUser: async () => ({ id: existing.conversationId })
      } as never,
      {} as never
    );

    await expect(
      service.share(actor, existing.conversationId)
    ).resolves.toEqual(existing);
  });

  test('reactivates an inactive share on re-share', async () => {
    const existing = shareRow({ isActive: false });
    let reactivatedId: string | undefined;
    const service = new ConversationSharesService(
      {
        findByConversationId: async () => existing,
        reactivate: async (id: string) => {
          reactivatedId = id;
          return { ...existing, isActive: true };
        },
        create: async () => {
          throw new Error('should not create a duplicate share');
        }
      } as never,
      {
        findForUser: async () => ({ id: existing.conversationId })
      } as never,
      {} as never
    );

    const share = await service.share(actor, existing.conversationId);

    expect(reactivatedId).toBe(existing.id);
    expect(share.isActive).toBe(true);
    expect(share.shareId).toBe(existing.shareId);
  });

  test('rejects sharing a conversation the actor does not own', async () => {
    const service = new ConversationSharesService(
      {
        findByConversationId: async () => {
          throw new Error('should not be reached');
        }
      } as never,
      { findForUser: async () => null } as never,
      {} as never
    );

    await expect(
      service.share(actor, crypto.randomUUID())
    ).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});

describe('conversation shares service - sharedView', () => {
  test('returns 404 for an unknown shareId', async () => {
    const service = new ConversationSharesService(
      { findActiveByShareId: async () => null } as never,
      {} as never,
      {} as never
    );

    await expect(service.sharedView('unknown')).rejects.toMatchObject({
      status: 404,
      code: 'not_found'
    });
  });

  test('returns 404 when the shared conversation was deleted', async () => {
    const service = new ConversationSharesService(
      {
        findActiveByShareId: async () => shareRow(),
        findActiveConversation: async () => null
      } as never,
      {} as never,
      {} as never
    );

    await expect(service.sharedView('a'.repeat(43))).rejects.toMatchObject({
      status: 404,
      code: 'not_found'
    });
  });

  test('exposes only title, advisor name, timestamps, and message role/content', async () => {
    const share = shareRow();
    const createdAt = new Date().toISOString();
    const service = new ConversationSharesService(
      {
        findActiveByShareId: async () => share,
        findActiveConversation: async () => ({
          title: 'Dashboard help',
          advisorId: 'data-dashboard',
          createdAt
        }),
        listSharedMessages: async () => [
          { role: 'user', content: 'Hello', createdAt },
          { role: 'assistant', content: 'Hi there', createdAt }
        ]
      } as never,
      {} as never,
      {
        findById: async () => ({ id: 'data-dashboard', name: 'Data Dashboard' })
      } as never
    );

    const view = await service.sharedView(share.shareId);

    expect(view).toEqual({
      conversation: {
        title: 'Dashboard help',
        advisorName: 'Data Dashboard',
        createdAt
      },
      messages: [
        { role: 'user', content: 'Hello', createdAt },
        { role: 'assistant', content: 'Hi there', createdAt }
      ]
    });
  });

  test('falls back to a generic advisor name when advisor is missing', async () => {
    const share = shareRow();
    const service = new ConversationSharesService(
      {
        findActiveByShareId: async () => share,
        findActiveConversation: async () => ({
          title: 'Untitled conversation',
          advisorId: 'retired-advisor',
          createdAt: new Date().toISOString()
        }),
        listSharedMessages: async () => []
      } as never,
      {} as never,
      { findById: async () => null } as never
    );

    const view = await service.sharedView(share.shareId);
    expect(view.conversation.advisorName).toBe('Advisor');
  });
});

describe('conversation shares serializer', () => {
  test('builds the share URL from the app origin', () => {
    const serializer = new ConversationSharesSerializer();
    const row = shareRow({ shareId: 'x'.repeat(43) });

    const response = serializer.link(row, 'https://advisor.example.com');

    expect(response.data).toEqual({
      shareId: row.shareId,
      url: `https://advisor.example.com/share/${row.shareId}`
    });
  });

  test('strips unexpected fields from the shared view', () => {
    const serializer = new ConversationSharesSerializer();
    const createdAt = new Date().toISOString();

    const response = serializer.sharedView({
      conversation: {
        title: 'Safe title',
        advisorName: 'Advisor',
        createdAt,
        userId: 'leak-me',
        systemPrompt: 'leak-me'
      },
      messages: [
        {
          role: 'user',
          content: 'Hello',
          createdAt,
          userId: 'leak-me',
          promptTokens: 42
        }
      ]
    } as never);

    expect(response.data.conversation).toEqual({
      title: 'Safe title',
      advisorName: 'Advisor',
      createdAt
    });
    expect(response.data.messages[0]).toEqual({
      role: 'user',
      content: 'Hello',
      createdAt
    });
  });
});

describe('conversation shares controller', () => {
  function createTestApp(options: {
    actorGetter?: () => Actor | undefined;
    service?: Partial<{
      share: (actor: Actor, id: string) => Promise<ConversationShareRow>;
      sharedView: (shareId: string) => Promise<unknown>;
    }>;
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

    const controller = new ConversationController(
      {} as never,
      { list: (rows: unknown) => ({ data: rows }) } as never,
      (options.service ?? {}) as never,
      new ConversationSharesSerializer(),
      { APP_ORIGIN: 'http://localhost:3000' }
    );

    app.route('/', controller.routes());
    return app;
  }

  test('POST /conversations/:id/share requires authentication', async () => {
    const app = createTestApp({ actorGetter: () => undefined });

    const response = await app.request(
      `/conversations/${crypto.randomUUID()}/share`,
      { method: 'POST' }
    );

    expect(response.status).toBe(401);
  });

  test('POST /conversations/:id/share returns shareId and url', async () => {
    const row = shareRow();
    const app = createTestApp({
      actorGetter: () => actor,
      service: { share: async () => row }
    });

    const response = await app.request(
      `/conversations/${row.conversationId}/share`,
      { method: 'POST' }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.shareId).toBe(row.shareId);
    expect(body.data.url).toBe(`http://localhost:3000/share/${row.shareId}`);
  });

  test('POST /conversations/:id/share rejects invalid UUID', async () => {
    const app = createTestApp({ actorGetter: () => actor });

    const response = await app.request('/conversations/not-a-uuid/share', {
      method: 'POST'
    });

    expect(response.status).toBe(400);
  });

  test('GET /share/:shareId is public and returns the shared view', async () => {
    const createdAt = new Date().toISOString();
    const app = createTestApp({
      actorGetter: () => undefined,
      service: {
        sharedView: async () => ({
          conversation: { title: 'Shared', advisorName: 'Advisor', createdAt },
          messages: [{ role: 'user', content: 'Hello', createdAt }]
        })
      }
    });

    const response = await app.request(`/share/${'a'.repeat(43)}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.conversation.title).toBe('Shared');
    expect(body.data.messages).toHaveLength(1);
  });

  test('GET /share/:shareId returns 404 for malformed share ids', async () => {
    const app = createTestApp({
      actorGetter: () => undefined,
      service: {
        sharedView: async () => {
          throw new Error('should not be reached');
        }
      }
    });

    const response = await app.request('/share/short');

    expect(response.status).toBe(404);
  });
});
