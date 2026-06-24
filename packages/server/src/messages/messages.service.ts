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
import {
  NoopKnowledgeContextResolver,
  type KnowledgeContext,
  type KnowledgeContextResolver
} from '../knowledge/knowledge-context.resolver';
import type { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { QueryPolicyService } from './query-policy.service';
import type { AnswerMode } from './query-policy.types';
import { createHash } from 'node:crypto';

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
      systemPromptHash: string;
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
  systemPromptHash: string;
  answerMode: AnswerMode;
  knowledgeContext: KnowledgeContext;
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
  private queryPolicyService: QueryPolicyService;
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
    queryPolicyService: QueryPolicyService,
    env: ServerEnv,
    private successfulTurnPersistenceService: SuccessfulTurnPersistenceService,
    private conversationTitleWorker: ConversationTitleWorker,
    private deferredTaskRunner: DeferredTaskRunner,
    private knowledgeContextResolver: KnowledgeContextResolver = new NoopKnowledgeContextResolver(),
    private knowledgeRepository?: KnowledgeRepository
  ) {
    this.promptContextService = promptContextService;
    this.llmProvider = llmProvider;
    this.costCapEnforcer = costCapEnforcer;
    this.usageCountersService = usageCountersService;
    this.telemetryService = telemetryService;
    this.queryPolicyService = queryPolicyService;
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

  private estimatedTurnBudget(
    config: { provider: string; model: string },
    estimatedInputTokens: number,
    maxOutputTokens: number
  ) {
    return this.modelRateService.estimatedTurnBudget(
      config,
      estimatedInputTokens,
      maxOutputTokens
    );
  }

  private requireText(value: unknown, message: string, code: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new HttpException(503, message, code);
    }

    return value;
  }

  private requireChatContent(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new HttpException(
        400,
        'Invalid chat message content',
        'chat_turn_invalid_input'
      );
    }

    return value;
  }

  private requireRuntimeText(value: unknown): string {
    return this.requireText(
      value,
      'Prompt context is incomplete',
      'prompt_context_incomplete'
    );
  }

  private requireModelText(value: unknown): string {
    return this.requireText(
      value,
      'Model configuration is incomplete',
      'model_config_incomplete'
    );
  }

  private normalizePromptContext(
    runtime: Awaited<
      ReturnType<AdvisorRuntimeService['resolveRunnableVersion']>
    >
  ) {
    return {
      systemPrompt: this.requireRuntimeText(
        runtime.promptContext?.systemPrompt
      ),
      systemPromptHash: this.requireRuntimeText(
        runtime.promptContext?.systemPromptHash
      ),
      promptSnapshotHash: this.requireRuntimeText(
        runtime.promptContext?.promptSnapshotHash
      ),
      promptDocRevision: this.requireRuntimeText(
        runtime.promptContext?.promptDocRevision
      ),
      dnaDigestVersion: this.requireRuntimeText(
        runtime.promptContext?.dnaDigestVersion
      )
    };
  }

  private validateCompletion(completion: {
    content: unknown;
    promptTokens: unknown;
    completionTokens: unknown;
    estimatedCostUsd: unknown;
    latencyMs: unknown;
  }) {
    if (
      typeof completion.content !== 'string' ||
      typeof completion.promptTokens !== 'number' ||
      typeof completion.completionTokens !== 'number' ||
      typeof completion.estimatedCostUsd !== 'string' ||
      completion.estimatedCostUsd.trim().length === 0 ||
      typeof completion.latencyMs !== 'number'
    ) {
      throw new HttpException(
        502,
        'LLM provider returned invalid usage metadata',
        'provider_usage_invalid'
      );
    }

    return completion as {
      content: string;
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: string;
      latencyMs: number;
    };
  }

  private validateStreamUsage(usage: LlmUsage) {
    if (
      typeof usage.promptTokens !== 'number' ||
      typeof usage.completionTokens !== 'number' ||
      typeof usage.totalTokens !== 'number' ||
      typeof usage.estimatedCostUsd !== 'string' ||
      usage.estimatedCostUsd.trim().length === 0
    ) {
      throw new HttpException(
        502,
        'LLM stream returned invalid usage metadata',
        'provider_usage_invalid'
      );
    }

    return usage;
  }

  private async prepareTurn(
    actor: Actor,
    input: StartTurnInput
  ): Promise<PreparedTurn> {
    const userContent = this.requireChatContent(input.content);
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

    const runtime =
      await this.advisorRuntimeService.resolveRunnableVersion(advisorId);

    if (!hasConversationId) {
      conversation = await this.conversationsService.createImplicit(actor, {
        advisorId,
        fallbackTitle: userContent.slice(0, 80),
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
      .map((message) => {
        if (typeof message.content !== 'string') {
          throw new HttpException(
            500,
            'Conversation history is invalid',
            'conversation_history_invalid'
          );
        }

        return {
          role: message.role,
          content: message.content
        };
      });

    const promptContext = this.normalizePromptContext(runtime);
    const modelConfig = {
      provider: this.requireModelText(runtime.modelConfig?.provider),
      model: this.requireModelText(runtime.modelConfig?.model)
    };

    const policy = this.queryPolicyService.classify({
      userContent,
      advisorPromptText: promptContext.systemPrompt,
      dnaDigestText: undefined
    });

    const knowledgeContext = await this.knowledgeContextResolver.resolve({
      advisorId,
      userContent,
      answerMode: policy.answerMode
    });

    const contextSection = knowledgeContext.contextText
      ? [
          '<selected_knowledge_context>',
          'Use this source-backed context for Eskwelabs-specific factual claims. If it does not support the requested fact, say you do not have that information based on the available advisor context.',
          knowledgeContext.contextText,
          '</selected_knowledge_context>'
        ].join('\n')
      : '';

    const augmentedSystemPrompt = [
      policy.answerContract,
      contextSection,
      promptContext.systemPrompt
    ]
      .filter(Boolean)
      .join('\n\n');

    const historyChars = history.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedInputTokens = Math.ceil(
      (augmentedSystemPrompt.length + historyChars + userContent.length) / 4
    );

    let reservation: CostReservation | undefined;

    try {
      const budget = this.estimatedTurnBudget(
        modelConfig,
        estimatedInputTokens,
        this.env.DEFAULT_MAX_OUTPUT_TOKENS
      );

      reservation = await this.reserveBudget({
        userId: actor.id,
        ...budget
      });

      const systemPromptHash = createHash('sha256')
        .update(augmentedSystemPrompt.trim())
        .digest('hex');

      const request: LlmChatRequest = {
        provider: modelConfig.provider,
        model: modelConfig.model,
        messages: [
          {
            role: 'system',
            content: augmentedSystemPrompt
          },
          ...history,
          { role: 'user', content: userContent }
        ]
      };

      return {
        conversation,
        runtime: {
          ...runtime,
          promptContext,
          modelConfig
        },
        isNewConversation,
        request,
        provider: modelConfig.provider,
        model: modelConfig.model,
        promptSnapshotHash: promptContext.promptSnapshotHash,
        promptDocRevision: promptContext.promptDocRevision,
        dnaDigestVersion: promptContext.dnaDigestVersion,
        systemPromptHash,
        answerMode: policy.answerMode,
        knowledgeContext,
        reservation,
        userContent,
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
      dnaDigestVersion: prepared.dnaDigestVersion,
      promptSnapshotHash: prepared.promptSnapshotHash,
      systemPromptHash: prepared.systemPromptHash,
      knowledgeContextHash: prepared.knowledgeContext.contextHash || undefined,
      knowledgeResolutionMode: prepared.knowledgeContext.mode,
      knowledgeUnitCount: prepared.knowledgeContext.evidence.length
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
      dnaDigestVersion: prepared.dnaDigestVersion,
      promptSnapshotHash: prepared.promptSnapshotHash,
      systemPromptHash: prepared.systemPromptHash,
      knowledgeContextHash: prepared.knowledgeContext.contextHash || undefined,
      knowledgeResolutionMode: prepared.knowledgeContext.mode,
      knowledgeUnitCount: prepared.knowledgeContext.evidence.length
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

    await this.recordKnowledgeAudit(actor, turn.assistantMessage.id, prepared);

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

  private async recordKnowledgeAudit(
    actor: Actor,
    assistantMessageId: string,
    prepared: PreparedTurn
  ) {
    if (!this.knowledgeRepository) return;
    if (prepared.knowledgeContext.evidence.length === 0) return;

    try {
      await this.knowledgeRepository.createAuditRows(
        prepared.knowledgeContext.evidence.map((evidence, index) => ({
          messageId: assistantMessageId,
          unitId: evidence.unitId ?? null,
          ruleId: evidence.ruleId ?? null,
          sourceRevision: evidence.sourceRevision ?? null,
          contentHash: evidence.contentHash ?? null,
          selectionRank: index + 1,
          score: evidence.score ?? null,
          resolverStrategy: evidence.strategy,
          usedInPrompt: true
        }))
      );
    } catch (error) {
      await this.recordTelemetry(
        'knowledge_audit_write_error',
        actor,
        'warning',
        {
          conversationId: prepared.conversation.id,
          code: this.errorTelemetryCode(error)
        }
      );
    }
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
      const completion = this.validateCompletion(
        await this.llmProvider.complete(prepared.request)
      );
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
      } else {
        await this.recordUnhandledErrorTelemetry(
          'chat_turn_unhandled_error',
          actor,
          error
        );
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
          if (typeof chunk.content !== 'string') {
            throw new HttpException(
              502,
              'LLM stream returned invalid content',
              'provider_stream_invalid'
            );
          }
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

      const validUsage = this.validateStreamUsage(usage);
      const completion = {
        content: content.trimEnd(),
        promptTokens: validUsage.promptTokens,
        completionTokens: validUsage.completionTokens,
        estimatedCostUsd: validUsage.estimatedCostUsd,
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
      } else {
        await this.recordUnhandledErrorTelemetry(
          'chat_turn_stream_unhandled_error',
          actor,
          error
        );
      }

      throw error;
    }
  }

  private async recordUnhandledErrorTelemetry(
    eventName: string,
    actor: Actor,
    error: unknown
  ) {
    await this.recordTelemetry(eventName, actor, 'error', {
      code: this.errorTelemetryCode(error, eventName),
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
