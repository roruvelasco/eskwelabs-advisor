import {
  MessagesRepository,
  type MessageCreateInput
} from './messages.repository';
import type {
  LlmChatRequest,
  LlmUsage,
  LlmProvider
} from '../adapters/advisor-adapters';
import { HttpException } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';
import type { ServerEnv } from '../config/env';
import type { ConversationsService } from '../conversations/conversations.service';
import type { ModelConfigService } from '../model-config/model-config.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { CostCapEnforcer } from '../usage-counters/cost-cap.service';
import { estimateModelCostUsd } from '../usage-counters/model-rates';
import type { UsageCountersService } from '../usage-counters/usage-counters.service';
import type { PromptContextLoader } from '../prompt-cache/prompt-context.service';

export class MessagesService {
  private static readonly HISTORY_MESSAGE_LIMIT = 20;
  private promptContextService: PromptContextLoader;
  private llmProvider: LlmProvider;
  private costCapEnforcer: CostCapEnforcer;
  private usageCountersService: UsageCountersService;
  private telemetryService: TelemetryService;
  private env: ServerEnv;

  constructor(
    private messagesRepository: MessagesRepository,
    private conversationsService: ConversationsService,
    private modelConfigService: ModelConfigService,
    promptContextService: PromptContextLoader,
    llmProvider: LlmProvider,
    costCapEnforcer: CostCapEnforcer,
    usageCountersService: UsageCountersService,
    telemetryService: TelemetryService,
    env: ServerEnv
  ) {
    this.promptContextService = promptContextService;
    this.llmProvider = llmProvider;
    this.costCapEnforcer = costCapEnforcer;
    this.usageCountersService = usageCountersService;
    this.telemetryService = telemetryService;
    this.env = env;
  }

  async list(actor: Actor, conversationId: string) {
    await this.conversationsService.assertOwns(actor, conversationId);
    return this.messagesRepository.listForConversation(conversationId);
  }

  private estimatedTurnBudget(config: { provider: string; model: string }) {
    const estimatedCostUsd = estimateModelCostUsd({
      provider: config.provider,
      model: config.model,
      promptTokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS,
      completionTokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS
    });

    if (estimatedCostUsd === null) {
      throw new HttpException(
        422,
        'Model rate is not configured',
        'model_rate_not_configured'
      );
    }

    return {
      estimatedTokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS * 2,
      estimatedCostUsd
    };
  }

  private async prepareTurn(
    actor: Actor,
    input: { conversationId: string; content: string }
  ) {
    const conversation = await this.conversationsService.assertOwns(
      actor,
      input.conversationId
    );
    const advisorId = conversation.advisorId;
    const config = await this.modelConfigService.getForAdvisor(advisorId);

    if (!config?.isEnabled) {
      throw new HttpException(
        429,
        'Advisor model is disabled',
        'model_disabled'
      );
    }

    await this.costCapEnforcer.assertAllowed({
      userId: actor.id,
      ...this.estimatedTurnBudget(config)
    });

    const promptContext =
      await this.promptContextService.getForAdvisor(advisorId);

    const history = (
      await this.messagesRepository.listForConversation(input.conversationId)
    )
      .filter(
        (message) =>
          message.status === 'ok' &&
          (message.role === 'user' || message.role === 'assistant')
      )
      .slice(-MessagesService.HISTORY_MESSAGE_LIMIT)
      .map((message) => ({
        role: message.role,
        content: message.content
      }));

    const request: LlmChatRequest = {
      provider: config.provider,
      model: config.model,
      messages: [
        {
          role: 'system',
          content: promptContext.systemPrompt
        },
        ...history,
        { role: 'user', content: input.content }
      ]
    };

    return {
      request,
      provider: config.provider,
      model: config.model,
      promptSnapshotHash: promptContext.promptSnapshotHash,
      promptDocRevision: promptContext.promptDocRevision,
      dnaDigestVersion: promptContext.dnaDigestVersion,
      userContent: input.content
    };
  }

  private async createBlockedTurn(
    actor: Actor,
    conversationId: string,
    content: string,
    blockReason: string
  ) {
    return this.messagesRepository.createErroredTurn(
      this.userMessageInput(actor, conversationId, content),
      {
        conversationId,
        userId: actor.id,
        role: 'assistant',
        content: 'Request blocked.',
        status: 'blocked',
        blockReason
      }
    );
  }

  private blockTelemetryReason(code: string) {
    if (code.includes('spend') || code.includes('budget')) return 'budget';
    if (code.includes('limit') || code.includes('disabled')) return 'cap';
    return code;
  }

  private async recordTelemetry(
    eventName: string,
    actor: Actor,
    severity: 'info' | 'warning' | 'error',
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService.record(
        eventName,
        actor.id,
        severity,
        payload
      );
    } catch {
      return;
    }
  }

  private userMessageInput(
    actor: Actor,
    conversationId: string,
    content: string
  ): MessageCreateInput {
    return {
      conversationId,
      userId: actor.id,
      role: 'user',
      content,
      status: 'ok'
    };
  }

  private assistantMessageInput(
    actor: Actor,
    conversationId: string,
    prepared: Awaited<ReturnType<MessagesService['prepareTurn']>>,
    completion: {
      content: string;
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: string;
      latencyMs: number;
    }
  ): MessageCreateInput {
    return {
      conversationId,
      userId: actor.id,
      role: 'assistant',
      content: completion.content,
      provider: prepared.provider,
      model: prepared.model,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostUsd: completion.estimatedCostUsd,
      latencyMs: completion.latencyMs,
      status: 'ok',
      promptDocRevision: prepared.promptDocRevision,
      dnaDigestVersion: prepared.dnaDigestVersion
    };
  }

  private assistantErrorMessageInput(
    actor: Actor,
    conversationId: string,
    prepared: Awaited<ReturnType<MessagesService['prepareTurn']>>,
    input: { content: string; blockReason: string }
  ): MessageCreateInput {
    return {
      conversationId,
      userId: actor.id,
      role: 'assistant',
      content: input.content,
      provider: prepared.provider,
      model: prepared.model,
      status: 'error',
      blockReason: input.blockReason,
      promptDocRevision: prepared.promptDocRevision,
      dnaDigestVersion: prepared.dnaDigestVersion
    };
  }

  private async persistSuccessfulTurn(
    actor: Actor,
    conversationId: string,
    prepared: Awaited<ReturnType<MessagesService['prepareTurn']>>,
    completion: {
      content: string;
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: string;
      latencyMs: number;
    }
  ) {
    const turn = await this.messagesRepository.createSuccessfulTurn(
      this.userMessageInput(actor, conversationId, prepared.userContent),
      this.assistantMessageInput(actor, conversationId, prepared, completion)
    );

    await this.usageCountersService.incrementTurn(actor.id, {
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostUsd: Number(completion.estimatedCostUsd)
    });

    await this.conversationsService.touch(conversationId);
    await this.recordTelemetry('chat_turn_completed', actor, 'info', {
      conversationId,
      provider: prepared.provider,
      model: prepared.model,
      promptSnapshotHash: prepared.promptSnapshotHash,
      dnaDigestVersion: prepared.dnaDigestVersion,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostUsd: completion.estimatedCostUsd
    });

    return turn;
  }

  async chatTurn(
    actor: Actor,
    input: { conversationId: string; content: string }
  ) {
    let prepared:
      | Awaited<ReturnType<MessagesService['prepareTurn']>>
      | undefined;

    try {
      prepared = await this.prepareTurn(actor, input);
      const completion = await this.llmProvider.complete(prepared.request);

      return this.persistSuccessfulTurn(
        actor,
        input.conversationId,
        prepared,
        completion
      );
    } catch (error) {
      if (prepared) {
        const blockReason =
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'chat_turn_error';
        await this.messagesRepository.createErroredTurn(
          this.userMessageInput(
            actor,
            input.conversationId,
            prepared.userContent
          ),
          this.assistantErrorMessageInput(
            actor,
            input.conversationId,
            prepared,
            {
              content: 'Request failed.',
              blockReason
            }
          )
        );
        await this.recordTelemetry('chat_turn_error', actor, 'error', {
          conversationId: input.conversationId,
          code: blockReason
        });
      } else if (error instanceof HttpException) {
        await this.createBlockedTurn(
          actor,
          input.conversationId,
          input.content,
          error.code
        );
        await this.recordTelemetry('chat_turn_blocked', actor, 'warning', {
          conversationId: input.conversationId,
          code: error.code
        });
        await this.recordTelemetry('request_blocked', actor, 'warning', {
          conversationId: input.conversationId,
          code: error.code,
          reason: this.blockTelemetryReason(error.code)
        });
      }
      throw error;
    }
  }

  async *streamChatTurn(
    actor: Actor,
    input: { conversationId: string; content: string }
  ) {
    let prepared:
      | Awaited<ReturnType<MessagesService['prepareTurn']>>
      | undefined;

    try {
      prepared = await this.prepareTurn(actor, input);
      const startedAt = Date.now();
      let content = '';
      let usage: LlmUsage | undefined;

      for await (const chunk of this.llmProvider.stream(prepared.request)) {
        if (chunk.type === 'delta') {
          content += chunk.content;
          yield { type: 'chunk' as const, content: chunk.content };
          continue;
        }

        usage = chunk.usage;
      }

      if (!usage) {
        throw new HttpException(
          502,
          'LLM stream ended without token usage',
          'missing_stream_usage'
        );
      }

      const completion = {
        content: content.trimEnd(),
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        estimatedCostUsd: usage.estimatedCostUsd,
        latencyMs: Date.now() - startedAt
      };

      const turn = await this.persistSuccessfulTurn(
        actor,
        input.conversationId,
        prepared,
        completion
      );

      yield {
        type: 'final' as const,
        data: {
          userMessage: turn.userMessage,
          assistantMessage: turn.assistantMessage
        }
      };
    } catch (error) {
      if (prepared) {
        const blockReason =
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'chat_stream_error';
        await this.messagesRepository.createErroredTurn(
          this.userMessageInput(
            actor,
            input.conversationId,
            prepared.userContent
          ),
          this.assistantErrorMessageInput(
            actor,
            input.conversationId,
            prepared,
            {
              content: 'Stream failed.',
              blockReason
            }
          )
        );
        await this.recordTelemetry('chat_turn_stream_error', actor, 'error', {
          conversationId: input.conversationId,
          code: blockReason
        });
      } else if (error instanceof HttpException) {
        await this.createBlockedTurn(
          actor,
          input.conversationId,
          input.content,
          error.code
        );
        await this.recordTelemetry(
          'chat_turn_stream_blocked',
          actor,
          'warning',
          {
            conversationId: input.conversationId,
            code: error.code
          }
        );
        await this.recordTelemetry('request_blocked', actor, 'warning', {
          conversationId: input.conversationId,
          code: error.code,
          reason: this.blockTelemetryReason(error.code)
        });
      }

      throw error;
    }
  }
}
