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
import type { ModelRateService } from '../model-config/model-rate.service';
import type { AdvisorRuntimeService } from '../advisors/advisor-runtime.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type {
  CostCapEnforcer,
  CostReservation
} from '../usage-counters/cost-cap.service';
import type { UsageCountersService } from '../usage-counters/usage-counters.service';
import type { PromptContextLoader } from '../prompt-cache/prompt-context.service';
import type { SuccessfulTurnPersistenceService } from '../conversation-titles/successful-turn-persistence.service';
import type { ConversationTitleWorker } from '../conversation-titles/conversation-title-worker';
import type { DeferredTaskRunner } from '../background/deferred-task-runner';

type StartTurnInput = {
  conversationId?: string;
  advisorId?: string;
  content: string;
  clientTurnId?: string;
};

type PreparedTurn = {
  conversation: {
    id: string;
    advisorId: string;
    advisorRuntimeVersionId?: string | null;
  };
  runtime: {
    runtimeVersionId: string;
    promptContext: {
      systemPrompt: string;
      promptSnapshotHash: string;
      promptDocRevision: string;
      dnaDigestVersion: string;
    };
    modelConfig: { provider: string; model: string };
  };
  isNewConversation: boolean;
  request: LlmChatRequest;
  provider: string;
  model: string;
  promptSnapshotHash: string;
  promptDocRevision: string;
  dnaDigestVersion: string;
  reservation: CostReservation | undefined;
  userContent: string;
  clientTurnId?: string;
};

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
    private modelRateService: ModelRateService,
    private advisorRuntimeService: AdvisorRuntimeService,
    promptContextService: PromptContextLoader,
    llmProvider: LlmProvider,
    costCapEnforcer: CostCapEnforcer,
    usageCountersService: UsageCountersService,
    telemetryService: TelemetryService,
    env: ServerEnv,
    private successfulTurnPersistenceService: SuccessfulTurnPersistenceService,
    private conversationTitleWorker: ConversationTitleWorker,
    private deferredTaskRunner: DeferredTaskRunner
  ) {
    this.promptContextService = promptContextService;
    this.llmProvider = llmProvider;
    this.costCapEnforcer = costCapEnforcer;
    this.usageCountersService = usageCountersService;
    this.telemetryService = telemetryService;
    this.env = env;
  }

  async list(
    actor: Actor,
    conversationId: string,
    limit?: number,
    cursor?: string
  ) {
    const conversation = await this.conversationsService.assertOwns(
      actor,
      conversationId
    );
    const result = await this.messagesRepository.listForConversation(
      conversationId,
      { limit, cursor }
    );
    if (!cursor && result.rows.length > 0) {
      await this.recordTelemetry('conversation_resumed', actor, 'info', {
        conversationId,
        advisorId: conversation.advisorId,
        messageCount: result.rows.length
      });
    }
    return result;
  }

  private async reserveBudget(input: {
    userId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }) {
    return this.costCapEnforcer.reserveTurn(input);
  }

  private async finalizeBudget(
    actor: Actor,
    reservation: CostReservation | undefined,
    completion: {
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: string;
    }
  ) {
    if (reservation) {
      await this.costCapEnforcer.finalizeReservation(reservation, {
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        estimatedCostUsd: Number(completion.estimatedCostUsd)
      });
      return;
    }

    await this.usageCountersService.incrementTurn(actor.id, {
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostUsd: Number(completion.estimatedCostUsd)
    });
  }

  private async releaseBudget(reservation?: CostReservation) {
    if (reservation) {
      try {
        await this.costCapEnforcer.releaseReservation(reservation);
      } catch {
        return;
      }
    }
  }

  private estimatedTurnBudget(config: { provider: string; model: string }) {
    return this.modelRateService.estimatedTurnBudget(
      config,
      this.env.DEFAULT_MAX_OUTPUT_TOKENS
    );
  }

  private async prepareTurn(
    actor: Actor,
    input: StartTurnInput
  ): Promise<PreparedTurn> {
    const hasConversationId = Boolean(input.conversationId);
    const hasAdvisorId = Boolean(input.advisorId);

    if (!hasConversationId && !hasAdvisorId) {
      throw new HttpException(
        400,
        'Either conversationId or advisorId is required',
        'validation_failed'
      );
    }

    if (hasConversationId && hasAdvisorId) {
      throw new HttpException(
        400,
        'Provide either conversationId or advisorId, not both',
        'validation_failed'
      );
    }

    let conversation: {
      id: string;
      advisorId: string;
      advisorRuntimeVersionId?: string | null;
    } = undefined!;
    let isNewConversation = false;

    if (hasConversationId) {
      const owned = await this.conversationsService.assertOwns(
        actor,
        input.conversationId!
      );
      conversation = {
        id: owned.id,
        advisorId: owned.advisorId
      };
    }

    const advisorId = hasConversationId
      ? conversation.advisorId
      : input.advisorId!;

    if (!hasConversationId) {
      conversation = { id: '', advisorId };
    }

    const modelConfigResult =
      await this.advisorRuntimeService.resolveModelConfig(advisorId);

    let reservation: CostReservation | undefined;

    try {
      const budget = this.estimatedTurnBudget(modelConfigResult.modelConfig);

      reservation = await this.reserveBudget({
        userId: actor.id,
        ...budget
      });

      const runtime =
        await this.advisorRuntimeService.resolveRunnableVersion(advisorId);

      if (!hasConversationId) {
        conversation = await this.conversationsService.createImplicit(actor, {
          advisorId,
          fallbackTitle: input.content.slice(0, 80),
          runtimeVersionId: runtime.runtimeVersionId
        });
        isNewConversation = true;
        await this.recordTelemetry('advisor_selected', actor, 'info', {
          advisorId,
          conversationId: conversation.id
        });
      }

      const history = (
        await this.messagesRepository.latestSuccessfulForConversation(
          conversation.id,
          MessagesService.HISTORY_MESSAGE_LIMIT
        )
      )
        .filter(
          (message) => message.role === 'user' || message.role === 'assistant'
        )
        .map((message) => ({
          role: message.role,
          content: message.content
        }));

      const request: LlmChatRequest = {
        provider: runtime.modelConfig.provider,
        model: runtime.modelConfig.model,
        messages: [
          {
            role: 'system',
            content: runtime.promptContext.systemPrompt
          },
          ...history,
          { role: 'user', content: input.content }
        ]
      };

      return {
        conversation,
        runtime,
        isNewConversation,
        request,
        provider: runtime.modelConfig.provider,
        model: runtime.modelConfig.model,
        promptSnapshotHash: runtime.promptContext.promptSnapshotHash,
        promptDocRevision: runtime.promptContext.promptDocRevision,
        dnaDigestVersion: runtime.promptContext.dnaDigestVersion,
        reservation,
        userContent: input.content,
        clientTurnId: input.clientTurnId
      };
    } catch (error) {
      await this.releaseBudget(reservation);
      throw error;
    }
  }

  private userMessageInput(
    actor: Actor,
    conversationId: string,
    content: string,
    clientTurnId?: string
  ): MessageCreateInput {
    return {
      conversationId,
      userId: actor.id,
      role: 'user',
      content,
      status: 'ok',
      clientTurnId
    };
  }

  private assistantMessageInput(
    actor: Actor,
    conversationId: string,
    prepared: PreparedTurn,
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
    prepared: PreparedTurn,
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
    prepared: PreparedTurn,
    completion: {
      content: string;
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: string;
      latencyMs: number;
    }
  ) {
    let turn: Awaited<ReturnType<SuccessfulTurnPersistenceService['persist']>>;

    try {
      turn = await this.successfulTurnPersistenceService.persist({
        userMessage: this.userMessageInput(
          actor,
          conversationId,
          prepared.userContent,
          prepared.clientTurnId
        ),
        assistantMessage: this.assistantMessageInput(
          actor,
          conversationId,
          prepared,
          completion
        ),
        titleGenerationModel: {
          provider: prepared.provider,
          model: prepared.model
        }
      });
    } catch (error) {
      await this.recordTelemetry('supabase_write_error', actor, 'error', {
        conversationId,
        code: this.errorTelemetryCode(error)
      });
      throw error;
    }

    await this.finalizeBudget(actor, prepared.reservation, completion);

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

  private baseTurnTelemetry(prepared: PreparedTurn) {
    return {
      conversationId: prepared.conversation.id,
      provider: prepared.provider,
      model: prepared.model,
      promptSnapshotHash: prepared.promptSnapshotHash,
      dnaDigestVersion: prepared.dnaDigestVersion
    };
  }

  private blockTelemetryReason(code: string) {
    if (code.includes('spend') || code.includes('budget')) return 'budget';
    if (code.includes('limit') || code.includes('disabled')) return 'cap';
    return code;
  }

  private errorTelemetryCode(error: unknown, fallback = 'unknown_error') {
    return error instanceof Error && 'code' in error
      ? String(error.code)
      : fallback;
  }

  private isAuthorizationFailure(error: HttpException) {
    return error.status === 401 || error.status === 403 || error.status === 404;
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

  async chatTurn(actor: Actor, input: StartTurnInput) {
    let prepared: PreparedTurn | undefined;
    let providerCallStarted = false;
    let providerCallCompleted = false;

    try {
      prepared = await this.prepareTurn(actor, input);
      await this.recordTelemetry('message_sent', actor, 'info', {
        ...this.baseTurnTelemetry(prepared),
        isNewConversation: prepared.isNewConversation
      });
      await this.recordTelemetry('llm_call_started', actor, 'info', {
        ...this.baseTurnTelemetry(prepared)
      });
      providerCallStarted = true;
      const completion = await this.llmProvider.complete(prepared.request);
      providerCallCompleted = true;
      await this.recordTelemetry('llm_call_completed', actor, 'info', {
        ...this.baseTurnTelemetry(prepared),
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        estimatedCostUsd: completion.estimatedCostUsd,
        latencyMs: completion.latencyMs
      });

      const turn = await this.persistSuccessfulTurn(
        actor,
        prepared.conversation.id,
        prepared,
        completion
      );

      if (turn.titleJobId) {
        this.deferredTaskRunner.run(async () => {
          await this.conversationTitleWorker.processJob(turn.titleJobId!);
        });
      }

      return {
        conversation: prepared.isNewConversation
          ? { id: prepared.conversation.id }
          : undefined,
        ...turn
      };
    } catch (error) {
      if (prepared) {
        await this.releaseBudget(prepared.reservation);
        const blockReason =
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'chat_turn_error';
        if (providerCallStarted && !providerCallCompleted) {
          await this.recordTelemetry('provider_error', actor, 'error', {
            ...this.baseTurnTelemetry(prepared),
            code: blockReason
          });
        }
        try {
          await this.messagesRepository.createErroredTurn(
            this.userMessageInput(
              actor,
              prepared.conversation.id,
              prepared.userContent,
              prepared.clientTurnId
            ),
            this.assistantErrorMessageInput(
              actor,
              prepared.conversation.id,
              prepared,
              { content: 'Request failed.', blockReason }
            )
          );
        } catch (writeError) {
          await this.recordTelemetry('supabase_write_error', actor, 'error', {
            ...this.baseTurnTelemetry(prepared),
            code: this.errorTelemetryCode(writeError)
          });
          // conversation may have been deleted concurrently; skip persistence
        }
        await this.recordTelemetry('chat_turn_error', actor, 'error', {
          conversationId: prepared.conversation.id,
          code: blockReason
        });
      } else if (
        error instanceof HttpException &&
        !this.isAuthorizationFailure(error)
      ) {
        await this.recordTelemetry('request_blocked', actor, 'warning', {
          code: error.code,
          reason: this.blockTelemetryReason(error.code)
        });
      }
      throw error;
    }
  }

  async *streamChatTurn(actor: Actor, input: StartTurnInput) {
    let prepared: PreparedTurn | undefined;
    let providerCallStarted = false;
    let providerCallCompleted = false;

    try {
      prepared = await this.prepareTurn(actor, input);
      await this.recordTelemetry('message_sent', actor, 'info', {
        ...this.baseTurnTelemetry(prepared),
        isNewConversation: prepared.isNewConversation
      });

      if (prepared.isNewConversation) {
        yield {
          type: 'conversation.ready' as const,
          data: { conversationId: prepared.conversation.id }
        };
      }

      const startedAt = Date.now();
      let content = '';
      let usage: LlmUsage | undefined;

      await this.recordTelemetry('llm_call_started', actor, 'info', {
        ...this.baseTurnTelemetry(prepared)
      });
      providerCallStarted = true;
      for await (const chunk of this.llmProvider.stream(prepared.request)) {
        if (chunk.type === 'delta') {
          content += chunk.content;
          yield { type: 'chunk' as const, content: chunk.content };
          continue;
        }

        usage = chunk.usage;
      }
      providerCallCompleted = Boolean(usage);

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
      await this.recordTelemetry('llm_call_completed', actor, 'info', {
        ...this.baseTurnTelemetry(prepared),
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        estimatedCostUsd: completion.estimatedCostUsd,
        latencyMs: completion.latencyMs
      });

      const turn = await this.persistSuccessfulTurn(
        actor,
        prepared.conversation.id,
        prepared,
        completion
      );

      if (turn.titleJobId) {
        this.deferredTaskRunner.run(async () => {
          await this.conversationTitleWorker.processJob(turn.titleJobId!);
        });
      }

      yield {
        type: 'final' as const,
        data: {
          userMessage: turn.userMessage,
          assistantMessage: turn.assistantMessage
        }
      };
    } catch (error) {
      if (prepared) {
        await this.releaseBudget(prepared.reservation);
        const blockReason =
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'chat_stream_error';
        if (providerCallStarted && !providerCallCompleted) {
          await this.recordTelemetry('provider_error', actor, 'error', {
            ...this.baseTurnTelemetry(prepared),
            code: blockReason
          });
        }
        try {
          await this.messagesRepository.createErroredTurn(
            this.userMessageInput(
              actor,
              prepared.conversation.id,
              prepared.userContent,
              prepared.clientTurnId
            ),
            this.assistantErrorMessageInput(
              actor,
              prepared.conversation.id,
              prepared,
              { content: 'Stream failed.', blockReason }
            )
          );
        } catch (writeError) {
          await this.recordTelemetry('supabase_write_error', actor, 'error', {
            ...this.baseTurnTelemetry(prepared),
            code: this.errorTelemetryCode(writeError)
          });
          // conversation may have been deleted concurrently; skip persistence
        }
        await this.recordTelemetry('chat_turn_stream_error', actor, 'error', {
          conversationId: prepared.conversation.id,
          code: blockReason
        });
      } else if (
        error instanceof HttpException &&
        !this.isAuthorizationFailure(error)
      ) {
        await this.recordTelemetry('request_blocked', actor, 'warning', {
          code: error.code,
          reason: this.blockTelemetryReason(error.code)
        });
      }

      throw error;
    }
  }
}
