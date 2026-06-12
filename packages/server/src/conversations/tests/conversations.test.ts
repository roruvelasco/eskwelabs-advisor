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
      {} as never,
      {} as never,
      {} as never
    );

    await expect(service.list()).resolves.toEqual([]);
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
});
