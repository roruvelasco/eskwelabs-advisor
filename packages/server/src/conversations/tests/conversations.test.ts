import { describe, expect, test } from 'bun:test';

import { HttpException } from '../../common/http/http-exception';
import type { Actor } from '../../common/utils/hono';
import { ConversationsService } from '../conversations.service';

const actor: Actor = {
  id: crypto.randomUUID(),
  email: 'eif@example.com',
  role: 'eif',
  isActive: true
};

describe('conversations service', () => {
  test('lists no conversations without an actor', async () => {
    const service = new ConversationsService(
      {} as never,
      {} as never,
      {} as never
    );

    await expect(service.list()).resolves.toEqual([]);
  });

  test('rejects conversation creation when advisor has no prompt Doc ID', async () => {
    const service = new ConversationsService(
      {
        create: async () => {
          throw new Error('conversation should not be created');
        }
      } as never,
      {
        getActive: async () => ({
          id: 'data-dashboard',
          name: 'Data Dashboard Advisor',
          description: 'Dashboard mentoring',
          promptDocId: null,
          isActive: true,
          createdAt: new Date()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          isEnabled: true,
          updatedAt: new Date()
        })
      } as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).rejects.toBeInstanceOf(HttpException);
  });

  test('allows conversation creation when no model config row exists', async () => {
    const service = new ConversationsService(
      {
        create: async () => ({
          id: crypto.randomUUID(),
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Test',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } as never,
      {
        getActive: async () => ({
          id: 'data-dashboard',
          name: 'Data Dashboard Advisor',
          description: 'Dashboard mentoring',
          promptDocId: 'prompt-doc-id',
          isActive: true,
          createdAt: new Date()
        })
      } as never,
      {
        getForAdvisor: async () => undefined
      } as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).resolves.toBeDefined();
  });

  test('rejects conversation creation when model config is disabled', async () => {
    const service = new ConversationsService(
      {
        create: async () => {
          throw new Error('conversation should not be created');
        }
      } as never,
      {
        getActive: async () => ({
          id: 'data-dashboard',
          name: 'Data Dashboard Advisor',
          description: 'Dashboard mentoring',
          promptDocId: 'prompt-doc-id',
          isActive: true,
          createdAt: new Date()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          isEnabled: false,
          updatedAt: new Date()
        })
      } as never
    );

    await expect(
      service.create(actor, { advisorId: 'data-dashboard' })
    ).rejects.toMatchObject({ code: 'advisor_not_configured' });
  });
});
