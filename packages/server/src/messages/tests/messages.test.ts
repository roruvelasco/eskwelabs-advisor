import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { HttpException } from '../../common/http/http-exception';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../messages.service';
import type { MessageRow } from '../messages.repository';
import type { Actor } from '../../common/utils/hono';
import type {
  LlmChatChunk,
  LlmChatRequest
} from '../../adapters/advisor-adapters';

const actor: Actor = {
  id: crypto.randomUUID(),
  email: 'eif@example.com',
  role: 'eif',
  isActive: true
};

type StreamEvent =
  | { type: 'chunk'; content: string }
  | {
      type: 'final';
      data: {
        assistantMessage: MessageRow;
      };
    };

async function* streamShouldNotBeCalled(): AsyncGenerator<LlmChatChunk> {
  if (Date.now() < 0) {
    yield {
      type: 'done',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: '0'
      }
    };
  }

  throw new Error('stream should not be called');
}

describe('messages service', () => {
  test('uses shared DNA digest independent of actor and advisor', async () => {
    const requests: LlmChatRequest[] = [];
    let dnaCalls = 0;

    function serviceFor(advisorId: string, requestMessages: MessageRow[] = []) {
      return new MessagesService(
        {
          listForConversation: async () => requestMessages,
          create: async (input: Omit<MessageRow, 'id' | 'createdAt'>) => ({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...input
          })
        } as never,
        {
          assertOwns: async () => ({
            id: crypto.randomUUID(),
            userId: actor.id,
            advisorId,
            title: 'Untitled',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        } as never,
        {
          getForAdvisor: async () => ({
            advisorId,
            provider: 'deterministic',
            model: 'deterministic-model',
            isEnabled: true,
            updatedAt: new Date().toISOString()
          })
        } as never,
        {
          fetchPrompt: async () => ({
            text: `System instructions for ${advisorId}`,
            revision: 'prompt-revision',
            hash: `prompt:${advisorId}`
          })
        },
        {
          getDigest: async () => {
            dnaCalls += 1;
            return {
              digest: 'shared dna digest',
              version: 'dna-v1',
              hash: 'dna:digest:shared'
            };
          }
        },
        {
          complete: async (request: LlmChatRequest) => {
            requests.push(request);
            return {
              content: 'ok',
              promptTokens: 10,
              completionTokens: 2,
              latencyMs: 1,
              estimatedCostUsd: '0.0001'
            };
          },
          stream: streamShouldNotBeCalled
        },
        { assertAllowed: async () => undefined } as never,
        { incrementTurn: async () => undefined } as never,
        { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never
      );
    }

    await serviceFor('data-dashboard').chatTurn(actor, {
      conversationId: crypto.randomUUID(),
      content: 'first'
    });
    await serviceFor('ssot-memo').chatTurn(
      { ...actor, id: crypto.randomUUID() },
      {
        conversationId: crypto.randomUUID(),
        content: 'second'
      }
    );

    expect(dnaCalls).toBe(2);
    expect(requests.map((request) => request.messages[0]?.content)).toEqual([
      'System instructions for data-dashboard\nshared dna digest',
      'System instructions for ssot-memo\nshared dna digest'
    ]);
  });

  test('runs a chat turn without leaking system prompt content', async () => {
    const container = createContainer();
    const conversationsService = container.get(ConversationsService);
    const messagesService = container.get(MessagesService);
    const conversation = await conversationsService.create(actor, {
      advisorId: 'data-dashboard'
    });

    const turn = await messagesService.chatTurn(actor, {
      conversationId: conversation.id,
      content: 'What should I inspect?'
    });

    expect(turn.assistantMessage.content).toContain('Draft response');
    expect(JSON.stringify(turn)).not.toContain('System instructions');
    expect(JSON.stringify(turn)).not.toContain('DNA digest');
  });

  test('streams chunks and a final safe payload', async () => {
    const container = createContainer();
    const conversationsService = container.get(ConversationsService);
    const messagesService = container.get(MessagesService);
    const conversation = await conversationsService.create(actor, {
      advisorId: 'data-dashboard'
    });

    const events: StreamEvent[] = [];
    for await (const event of messagesService.streamChatTurn(actor, {
      conversationId: conversation.id,
      content: 'Stream this'
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'chunk')).toBe(true);
    expect(events.at(-1)?.type).toBe('final');
    expect(JSON.stringify(events)).not.toContain('System instructions');
    expect(JSON.stringify(events)).not.toContain('DNA digest');
    expect(
      events.find((event) => event.type === 'final')?.data.assistantMessage
        .promptTokens
    ).toBe(100);
  });

  test('includes bounded successful conversation history before the newest user message', async () => {
    let capturedRequest: LlmChatRequest | undefined;
    const history = Array.from({ length: 25 }, (_, index): MessageRow => ({
      id: crypto.randomUUID(),
      conversationId: 'conversation-id',
      userId: actor.id,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `history-${index}`,
      status: 'ok',
      createdAt: new Date(index).toISOString()
    }));

    history.splice(5, 0, {
      id: crypto.randomUUID(),
      conversationId: 'conversation-id',
      userId: actor.id,
      role: 'assistant',
      content: 'blocked-history',
      status: 'blocked',
      blockReason: 'daily_message_limit',
      createdAt: new Date().toISOString()
    });

    const service = new MessagesService(
      {
        listForConversation: async () => history,
        create: async (input: Omit<MessageRow, 'id' | 'createdAt'>) => ({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...input
        })
      } as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'deterministic',
          model: 'deterministic-model',
          isEnabled: true,
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        fetchPrompt: async () => ({
          text: 'System instructions',
          revision: 'prompt-revision',
          hash: 'prompt-hash'
        })
      },
      {
        getDigest: async () => ({
          digest: 'shared dna digest',
          version: 'dna-v1',
          hash: 'dna-hash'
        })
      },
      {
        complete: async (request: LlmChatRequest) => {
          capturedRequest = request;
          return {
            content: 'ok',
            promptTokens: 10,
            completionTokens: 2,
            latencyMs: 1,
            estimatedCostUsd: '0.0001'
          };
        },
        stream: streamShouldNotBeCalled
      },
      { assertAllowed: async () => undefined } as never,
      { incrementTurn: async () => undefined } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never
    );

    await service.chatTurn(actor, {
      conversationId: crypto.randomUUID(),
      content: 'newest'
    });

    expect(capturedRequest?.messages.map((message) => message.content)).toEqual([
      'System instructions\nshared dna digest',
      ...Array.from({ length: 20 }, (_, index) => `history-${index + 5}`),
      'newest'
    ]);
    expect(JSON.stringify(capturedRequest)).not.toContain('blocked-history');
  });

  test('requires terminal stream usage before persisting streamed assistant usage', async () => {
    const createdMessages: MessageRow[] = [];
    const increments: unknown[] = [];
    const service = new MessagesService(
      {
        listForConversation: async () => [],
        create: async (input: Omit<MessageRow, 'id' | 'createdAt'>) => {
          const row = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...input
          };
          createdMessages.push(row);
          return row;
        }
      } as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'deterministic',
          model: 'deterministic-model',
          isEnabled: true,
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        fetchPrompt: async () => ({
          text: 'System instructions',
          revision: 'prompt-revision',
          hash: 'prompt-hash'
        })
      },
      {
        getDigest: async () => ({
          digest: 'shared dna digest',
          version: 'dna-v1',
          hash: 'dna-hash'
        })
      },
      {
        complete: async () => {
          throw new Error('complete should not be called');
        },
        async *stream() {
          yield { type: 'delta' as const, content: 'partial ' };
        }
      },
      { assertAllowed: async () => undefined } as never,
      {
        incrementTurn: async (_userId: string, input: unknown) => {
          increments.push(input);
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never
    );

    const events: StreamEvent[] = [];
    await expect(async () => {
      for await (const event of service.streamChatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'stream'
      })) {
        events.push(event);
      }
    }).toThrow('LLM stream ended without token usage');

    expect(events).toEqual([{ type: 'chunk', content: 'partial ' }]);
    expect(increments).toEqual([]);
    expect(createdMessages).toHaveLength(2);
    expect(createdMessages.at(-1)).toMatchObject({
      role: 'assistant',
      status: 'error',
      blockReason: 'missing_stream_usage'
    });
  });

  test('blocks before prompt and provider work when caps fail', async () => {
    let promptCalls = 0;
    let providerCalls = 0;
    const createdMessages: MessageRow[] = [];
    const service = new MessagesService(
      {
        listForConversation: async () => [],
        create: async (input: Omit<MessageRow, 'id' | 'createdAt'>) => {
          const row = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            ...input
          };
          createdMessages.push(row);
          return row;
        }
      } as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'deterministic',
          model: 'deterministic-model',
          isEnabled: true,
          updatedAt: new Date().toISOString()
        })
      } as never,
      {
        fetchPrompt: async () => {
          promptCalls += 1;
          throw new Error('prompt should not be fetched');
        }
      },
      {
        getDigest: async () => {
          throw new Error('dna should not be generated');
        }
      },
      {
        complete: async () => {
          providerCalls += 1;
          throw new Error('provider should not be called');
        },
        async *stream() {
          providerCalls += 1;
          yield { type: 'delta' as const, content: '' };
        }
      },
      {
        assertAllowed: async () => {
          throw new HttpException(429, 'Daily message limit reached', 'daily_message_limit');
        }
      } as never,
      {
        incrementTurn: async () => undefined
      } as never,
      {
        DEFAULT_MAX_OUTPUT_TOKENS: 2000
      } as never
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'blocked'
      })
    ).rejects.toMatchObject({ code: 'daily_message_limit' });

    expect(promptCalls).toBe(0);
    expect(providerCalls).toBe(0);
    expect(createdMessages).toHaveLength(1);
    expect(createdMessages[0]).toMatchObject({
      status: 'blocked',
      blockReason: 'daily_message_limit'
    });
  });
});
