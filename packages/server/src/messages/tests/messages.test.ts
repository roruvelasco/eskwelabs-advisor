import { describe, expect, test } from 'bun:test';

import { HttpException } from '../../common/http/http-exception';
import { MessagesService } from '../messages.service';
import type { MessageCreateInput, MessageRow } from '../messages.repository';
import type { Actor } from '../../common/utils/hono';
import type {
  LlmChatChunk,
  LlmChatRequest
} from '../../adapters/advisor-adapters';
import { CompiledSystemPromptBuilder } from '../../prompt-cache/compiled-system-prompt.builder';

const actor: Actor = {
  id: crypto.randomUUID(),
  email: 'eif@example.com',
  role: 'eif',
  isActive: true
};

let testSeq = 0;

type StreamEvent =
  | { type: 'conversation.ready'; data: { conversationId: string } }
  | { type: 'chunk'; content: string }
  | {
      type: 'final';
      data: {
        assistantMessage: MessageRow;
      };
    };

function createPersistenceService() {
  return {
    persist: async (input: unknown) => {
      const i = input as {
        userMessage: MessageCreateInput;
        assistantMessage: MessageCreateInput;
      };
      return {
        userMessage: {
          id: crypto.randomUUID(),
          conversationId: i.userMessage.conversationId,
          userId: i.userMessage.userId,
          role: 'user' as const,
          content: i.userMessage.content,
          status: 'ok' as const,
          seq: ++testSeq,
          createdAt: new Date().toISOString()
        },
        assistantMessage: {
          id: crypto.randomUUID(),
          conversationId: i.assistantMessage.conversationId,
          userId: i.assistantMessage.userId,
          role: 'assistant' as const,
          content: i.assistantMessage.content,
          status: 'ok' as const,
          provider: i.assistantMessage.provider,
          model: i.assistantMessage.model,
          promptTokens: i.assistantMessage.promptTokens,
          completionTokens: i.assistantMessage.completionTokens,
          estimatedCostUsd: i.assistantMessage.estimatedCostUsd,
          latencyMs: i.assistantMessage.latencyMs,
          promptDocRevision: i.assistantMessage.promptDocRevision,
          dnaDigestVersion: i.assistantMessage.dnaDigestVersion,
          seq: ++testSeq,
          createdAt: new Date().toISOString()
        }
      };
    }
  } as never;
}

function createTitleWorker() {
  return {
    processJob: async () => ({ state: 'completed' as const, applied: true })
  } as never;
}

function createDeferredRunner() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return { run: (_task: () => Promise<void>) => {} } as never;
}

function createCostCapEnforcer(opts?: {
  onReserveTurn?: (budget: {
    userId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }) => void;
  throwCode?: string;
}) {
  return {
    reserveTurn: async (budget: {
      userId: string;
      estimatedTokens: number;
      estimatedCostUsd: number;
    }) => {
      if (opts?.throwCode) {
        throw new HttpException(429, 'Cap reached', opts.throwCode);
      }
      opts?.onReserveTurn?.(budget);
      return budget;
    },
    finalizeReservation: async () => undefined,
    releaseReservation: async () => undefined
  } as never;
}

function createModelRateService(config?: {
  provider?: string;
  model?: string;
  assertConfigured?: () => void;
}) {
  return {
    assertRateConfigured: () => {
      if (config?.assertConfigured) {
        config.assertConfigured();
      }
    },
    estimatedTurnBudget: () => {
      if (config?.assertConfigured) {
        config.assertConfigured();
      }
      return { estimatedTokens: 4000, estimatedCostUsd: 0.001 };
    }
  } as never;
}

function createAdvisorRuntimeService(runtime: {
  advisorId: string;
  advisorName?: string;
  runtimeVersionId?: string;
  promptContext?: {
    systemPrompt?: string;
    systemPromptHash?: string;
    promptSnapshotHash?: string;
    promptDocRevision?: string;
    dnaDigestVersion?: string;
  };
  modelConfig?: {
    provider: string;
    model: string;
    isEnabled?: boolean;
  };
}) {
  return {
    resolveRunnableVersion: async () => ({
      advisorId: runtime.advisorId,
      advisorName: runtime.advisorName ?? runtime.advisorId,
      runtimeVersionId: runtime.runtimeVersionId ?? crypto.randomUUID(),
      promptContext: {
        systemPrompt:
          runtime.promptContext?.systemPrompt ??
          'System instructions <scope_policy>\nshared dna digest',
        systemPromptHash:
          runtime.promptContext?.systemPromptHash ?? 'sys-prompt-hash',
        promptSnapshotHash:
          runtime.promptContext?.promptSnapshotHash ?? 'prompt-hash',
        promptDocRevision:
          runtime.promptContext?.promptDocRevision ?? 'prompt-revision',
        dnaDigestVersion: runtime.promptContext?.dnaDigestVersion ?? 'dna-hash'
      },
      modelConfig: {
        provider: runtime.modelConfig?.provider ?? 'deterministic',
        model: runtime.modelConfig?.model ?? 'deterministic-model',
        isEnabled: runtime.modelConfig?.isEnabled ?? true
      }
    }),
    checkReadiness: async () => ({
      ready: true as const,
      reasons: [] as []
    })
  } as never;
}

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

function createMessageRow(input: MessageCreateInput): MessageRow {
  return {
    id: crypto.randomUUID(),
    seq: ++testSeq,
    createdAt: new Date().toISOString(),
    ...input
  };
}

function createMessageRepository(input?: {
  history?: MessageRow[];
  createdMessages?: MessageRow[];
}) {
  const history = input?.history ?? [];
  const createdMessages = input?.createdMessages ?? [];

  return {
    listForConversation: async () => ({ rows: history, nextCursor: null }),
    latestSuccessfulForConversation: async (
      _conversationId: string,
      limit?: number
    ) => {
      const ok = history.filter((m) => m.status === 'ok');
      const take = limit ?? 20;
      return ok.slice(-take);
    },
    create: async (message: MessageCreateInput) => {
      const row = createMessageRow(message);
      createdMessages.push(row);
      return row;
    },
    createSuccessfulTurn: async (
      userMessage: MessageCreateInput,
      assistantMessage: MessageCreateInput
    ) => {
      const userRow = createMessageRow(userMessage);
      const assistantRow = createMessageRow(assistantMessage);
      createdMessages.push(userRow, assistantRow);
      return {
        userMessage: userRow,
        assistantMessage: assistantRow
      };
    },
    createErroredTurn: async (
      userMessage: MessageCreateInput,
      assistantMessage: MessageCreateInput
    ) => {
      const userRow = createMessageRow(userMessage);
      const assistantRow = createMessageRow(assistantMessage);
      createdMessages.push(userRow, assistantRow);
      return {
        userMessage: userRow,
        assistantMessage: assistantRow
      };
    }
  };
}

function createPromptContext(input?: {
  advisorPromptText?: string;
  dnaDigestText?: string;
  promptSnapshotHash?: string;
  promptDocRevision?: string;
  dnaDigestVersion?: string;
  onLoad?: () => void;
}) {
  return {
    getForAdvisor: async () => {
      input?.onLoad?.();
      const advisorPromptText =
        input?.advisorPromptText ?? 'System instructions';
      const dnaDigestText = input?.dnaDigestText ?? 'shared dna digest';
      const compiled = new CompiledSystemPromptBuilder().build({
        advisorPromptText,
        dnaDigestText
      });

      return {
        systemPrompt: compiled.text,
        systemPromptHash: compiled.hash,
        promptSnapshotHash: input?.promptSnapshotHash ?? 'prompt-hash',
        promptDocRevision: input?.promptDocRevision ?? 'prompt-revision',
        dnaDigestVersion: input?.dnaDigestVersion ?? 'dna-hash'
      };
    }
  };
}

describe('messages service', () => {
  test('uses shared DNA digest independent of actor and advisor', async () => {
    const requests: LlmChatRequest[] = [];
    let dnaCalls = 0;

    function serviceFor(advisorId: string, requestMessages: MessageRow[] = []) {
      return new MessagesService(
        createMessageRepository({ history: requestMessages }) as never,
        {
          assertOwns: async () => ({
            id: crypto.randomUUID(),
            userId: actor.id,
            advisorId,
            title: 'Untitled',
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }),
          touch: async () => undefined
        } as never,
        createModelRateService(),
        createAdvisorRuntimeService({
          advisorId,
          promptContext: {
            systemPrompt: `System instructions for ${advisorId}\n<scope_policy>\nshared dna digest`,
            promptSnapshotHash: `prompt:${advisorId}`,
            dnaDigestVersion: 'dna:digest:shared'
          },
          modelConfig: {
            provider: 'deterministic',
            model: 'deterministic-model'
          }
        }),
        {
          getForAdvisor: async () => {
            dnaCalls += 1;
            return {
              systemPrompt: `System instructions for ${advisorId}\n<scope_policy>\nshared dna digest`,
              systemPromptHash: 'hash',
              promptSnapshotHash: `prompt:${advisorId}`,
              promptDocRevision: 'revision',
              dnaDigestVersion: 'dna:digest:shared'
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
        createCostCapEnforcer(),
        { incrementTurn: async () => undefined } as never,
        { record: async () => undefined } as never,
        { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
        createPersistenceService(),
        createTitleWorker(),
        createDeferredRunner()
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

    expect(dnaCalls).toBe(0);
    const systemPrompts = requests.map(
      (request) => request.messages[0]?.content ?? ''
    );
    expect(systemPrompts[0]).toContain('<scope_policy>');
    expect(systemPrompts[0]).toContain('shared dna digest');
    expect(systemPrompts[0]).toContain(
      'System instructions for data-dashboard'
    );
    expect(systemPrompts[1]).toContain('shared dna digest');
    expect(systemPrompts[1]).toContain('System instructions for ssot-memo');
  });

  test('runs a chat turn without leaking system prompt content', async () => {
    const conversationId = crypto.randomUUID();
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const messagesService = new MessagesService(
      createMessageRepository() as never,
      {
        assertOwns: async () => ({
          id: conversationId,
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        promptContext: {
          systemPrompt: 'System instructions\n<scope_policy>\nDNA digest'
        },
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'DNA digest'
      }),
      {
        complete: async () => ({
          content: 'Draft response for the learner.',
          promptTokens: 100,
          completionTokens: 20,
          latencyMs: 1,
          estimatedCostUsd: '0.001'
        }),
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    const turn = await messagesService.chatTurn(actor, {
      conversationId,
      content: 'What should I inspect?'
    });

    expect(turn.assistantMessage.content).toContain('Draft response');
    expect(JSON.stringify(turn)).not.toContain('System instructions');
    expect(JSON.stringify(turn)).not.toContain('DNA digest');
    expect(telemetry.map((event) => event.eventName)).toEqual([
      'message_sent',
      'llm_call_started',
      'llm_call_completed',
      'chat_turn_completed'
    ]);
    expect(telemetry).toContainEqual({
      eventName: 'llm_call_completed',
      payload: expect.objectContaining({
        conversationId,
        provider: 'deterministic',
        model: 'deterministic-model',
        promptTokens: 100,
        completionTokens: 20,
        estimatedCostUsd: '0.001'
      })
    });
  });

  test('streams chunks and a final safe payload', async () => {
    const conversationId = crypto.randomUUID();
    const messagesService = new MessagesService(
      createMessageRepository() as never,
      {
        assertOwns: async () => ({
          id: conversationId,
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        promptContext: {
          systemPrompt: 'System instructions\n<scope_policy>\nDNA digest'
        },
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'DNA digest'
      }),
      {
        complete: async () => {
          throw new Error('complete should not be called');
        },
        async *stream() {
          yield { type: 'delta' as const, content: 'Draft ' };
          yield { type: 'delta' as const, content: 'response' };
          yield {
            type: 'done' as const,
            usage: {
              promptTokens: 100,
              completionTokens: 20,
              totalTokens: 120,
              estimatedCostUsd: '0.001'
            }
          };
        }
      },
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      { record: async () => undefined } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    const events: StreamEvent[] = [];
    for await (const event of messagesService.streamChatTurn(actor, {
      conversationId,
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
    const history = Array.from(
      { length: 25 },
      (_, index): MessageRow => ({
        id: crypto.randomUUID(),
        conversationId: 'conversation-id',
        userId: actor.id,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `history-${index}`,
        status: 'ok',
        seq: index + 1,
        createdAt: new Date(index).toISOString()
      })
    );

    history.splice(5, 0, {
      id: crypto.randomUUID(),
      conversationId: 'conversation-id',
      userId: actor.id,
      role: 'assistant',
      content: 'blocked-history',
      status: 'blocked',
      blockReason: 'daily_message_limit',
      seq: 100,
      createdAt: new Date().toISOString()
    });

    const service = new MessagesService(
      createMessageRepository({ history }) as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'shared dna digest'
      }),
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
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      { record: async () => undefined } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await service.chatTurn(actor, {
      conversationId: crypto.randomUUID(),
      content: 'newest'
    });

    const messageContents =
      capturedRequest?.messages.map((message) => message.content) ?? [];
    expect(messageContents[0]).toContain('<scope_policy>');
    expect(messageContents[0]).toContain('shared dna digest');
    expect(messageContents[0]).toContain('System instructions');
    expect(messageContents.slice(1)).toEqual([
      ...Array.from({ length: 20 }, (_, index) => `history-${index + 5}`),
      'newest'
    ]);
    expect(JSON.stringify(capturedRequest)).not.toContain('blocked-history');
  });

  test('requires terminal stream usage before persisting streamed assistant usage', async () => {
    const createdMessages: MessageRow[] = [];
    const increments: unknown[] = [];
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
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
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'shared dna digest'
      }),
      {
        complete: async () => {
          throw new Error('complete should not be called');
        },
        async *stream() {
          yield { type: 'delta' as const, content: 'partial ' };
        }
      },
      createCostCapEnforcer(),
      {
        incrementTurn: async (_userId: string, input: unknown) => {
          increments.push(input);
        }
      } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
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
    expect(telemetry).toContainEqual({
      eventName: 'provider_error',
      payload: expect.objectContaining({
        conversationId: 'conversation-id',
        code: 'missing_stream_usage'
      })
    });
  });

  test('passes nonzero model-rate spend estimate into cap checks', async () => {
    let capturedBudget:
      | { userId: string; estimatedTokens: number; estimatedCostUsd: number }
      | undefined;
    const service = new MessagesService(
      createMessageRepository() as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'gemini', model: 'gemini-2.5-flash-lite' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'shared dna digest'
      }),
      {
        complete: async () => ({
          content: 'ok',
          promptTokens: 10,
          completionTokens: 2,
          latencyMs: 1,
          estimatedCostUsd: '0.000001'
        }),
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer({
        onReserveTurn: (b) => {
          capturedBudget = b;
        }
      }),
      { incrementTurn: async () => undefined } as never,
      { record: async () => undefined } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await service.chatTurn(actor, {
      conversationId: crypto.randomUUID(),
      content: 'estimate'
    });

    expect(capturedBudget).toEqual({
      userId: actor.id,
      estimatedTokens: 4000,
      estimatedCostUsd: 0.001
    });
  });

  test('blocks unknown model rates before prompt and provider work', async () => {
    let promptCalls = 0;
    let providerCalls = 0;
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const createdMessages: MessageRow[] = [];
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
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
      createModelRateService({
        assertConfigured: () => {
          throw new HttpException(
            422,
            'Model rate is not configured',
            'model_rate_not_configured'
          );
        }
      }),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'unknown', model: 'unknown-model' }
      }),
      {
        getForAdvisor: async () => {
          promptCalls += 1;
          throw new Error('prompt context should not be loaded');
        }
      },
      {
        complete: async () => {
          providerCalls += 1;
          throw new Error('provider should not be called');
        },
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'blocked'
      })
    ).rejects.toMatchObject({ code: 'model_rate_not_configured' });

    expect(promptCalls).toBe(0);
    expect(providerCalls).toBe(0);
    expect(createdMessages).toHaveLength(0);
    expect(telemetry).toContainEqual({
      eventName: 'request_blocked',
      payload: expect.objectContaining({
        code: 'model_rate_not_configured',
        reason: 'model_rate_not_configured'
      })
    });
  });

  test('persists paired user and assistant error rows when provider fails after preflight', async () => {
    const createdMessages: MessageRow[] = [];
    const increments: unknown[] = [];
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'shared dna digest'
      }),
      {
        complete: async () => {
          throw new HttpException(502, 'Provider failed', 'provider_error');
        },
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer(),
      {
        incrementTurn: async (_userId: string, input: unknown) => {
          increments.push(input);
        }
      } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'provider failure'
      })
    ).rejects.toMatchObject({ code: 'provider_error' });

    expect(increments).toEqual([]);
    expect(createdMessages).toHaveLength(2);
    expect(createdMessages[0]).toMatchObject({
      role: 'user',
      status: 'ok',
      content: 'provider failure'
    });
    expect(createdMessages[1]).toMatchObject({
      role: 'assistant',
      status: 'error',
      blockReason: 'provider_error'
    });
    expect(telemetry.map((event) => event.eventName)).toContain(
      'provider_error'
    );
    expect(telemetry).toContainEqual({
      eventName: 'provider_error',
      payload: expect.objectContaining({
        conversationId: 'conversation-id',
        provider: 'deterministic',
        model: 'deterministic-model',
        code: 'provider_error'
      })
    });
  });

  test('records supabase_write_error when successful turn persistence fails', async () => {
    const createdMessages: MessageRow[] = [];
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const persistenceError = new Error('write failed') as Error & {
      code: string;
    };
    persistenceError.code = 'supabase_write_failed';
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
      {
        assertOwns: async () => ({
          id: 'conversation-id',
          userId: actor.id,
          advisorId: 'data-dashboard',
          title: 'Untitled',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
        touch: async () => undefined
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      createPromptContext({
        advisorPromptText: 'System instructions',
        dnaDigestText: 'shared dna digest'
      }),
      {
        complete: async () => ({
          content: 'ok',
          promptTokens: 10,
          completionTokens: 2,
          latencyMs: 1,
          estimatedCostUsd: '0.0001'
        }),
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      {
        persist: async () => {
          throw persistenceError;
        }
      } as never,
      createTitleWorker(),
      createDeferredRunner()
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'persist this'
      })
    ).rejects.toThrow('write failed');

    expect(createdMessages).toHaveLength(2);
    expect(telemetry).toContainEqual({
      eventName: 'supabase_write_error',
      payload: expect.objectContaining({
        conversationId: 'conversation-id',
        code: 'supabase_write_failed'
      })
    });
  });

  test('blocks before prompt and provider work when caps fail', async () => {
    let promptCalls = 0;
    let providerCalls = 0;
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const createdMessages: MessageRow[] = [];
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
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
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      {
        getForAdvisor: async () => {
          promptCalls += 1;
          throw new Error('prompt context should not be loaded');
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
      createCostCapEnforcer({ throwCode: 'daily_message_limit' }),
      {
        incrementTurn: async () => undefined
      } as never,
      {
        record: async (
          eventName: string,
          _actorId: string,
          _severity: string,
          payload: unknown
        ) => {
          telemetry.push({ eventName, payload });
        }
      } as never,
      {
        DEFAULT_MAX_OUTPUT_TOKENS: 2000
      } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'blocked'
      })
    ).rejects.toMatchObject({ code: 'daily_message_limit' });

    expect(promptCalls).toBe(0);
    expect(providerCalls).toBe(0);
    expect(createdMessages).toHaveLength(0);
    expect(telemetry).toContainEqual({
      eventName: 'request_blocked',
      payload: expect.objectContaining({
        code: 'daily_message_limit',
        reason: 'cap'
      })
    });
  });

  test('does not persist blocked rows when conversation ownership fails', async () => {
    const createdMessages: MessageRow[] = [];
    const service = new MessagesService(
      createMessageRepository({ createdMessages }) as never,
      {
        assertOwns: async () => {
          throw new HttpException(403, 'Forbidden', 'forbidden');
        }
      } as never,
      createModelRateService(),
      createAdvisorRuntimeService({
        advisorId: 'data-dashboard',
        modelConfig: { provider: 'deterministic', model: 'deterministic-model' }
      }),
      {
        getForAdvisor: async () => {
          throw new Error('prompt context should not be loaded');
        }
      },
      {
        complete: async () => {
          throw new Error('provider should not be called');
        },
        stream: streamShouldNotBeCalled
      },
      createCostCapEnforcer(),
      { incrementTurn: async () => undefined } as never,
      { record: async () => undefined } as never,
      { DEFAULT_MAX_OUTPUT_TOKENS: 2000 } as never,
      createPersistenceService(),
      createTitleWorker(),
      createDeferredRunner()
    );

    await expect(
      service.chatTurn(actor, {
        conversationId: crypto.randomUUID(),
        content: 'wrong owner'
      })
    ).rejects.toMatchObject({ code: 'forbidden' });

    expect(createdMessages).toEqual([]);
  });
});
