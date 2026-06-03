import { MessagesRepository } from './messages.repository';
import type {
  DnaDigestGenerator,
  GoogleDocsPromptFetcher,
  LlmChatRequest,
  LlmUsage,
  LlmProvider
} from '../adapters/advisor-adapters';
import { HttpException } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';
import type { ServerEnv } from '../config/env';
import type { ConversationsService } from '../conversations/conversations.service';
import type { ModelConfigService } from '../model-config/model-config.service';
import type { CostCapEnforcer } from '../usage-counters/cost-cap.service';
import type { UsageCountersService } from '../usage-counters/usage-counters.service';

export class MessagesService {
  private static readonly HISTORY_MESSAGE_LIMIT = 20;

  constructor(
    private messagesRepository: MessagesRepository,
    private conversationsService: ConversationsService,
    private modelConfigService: ModelConfigService,
    private promptFetcher: GoogleDocsPromptFetcher,
    private dnaDigestGenerator: DnaDigestGenerator,
    private llmProvider: LlmProvider,
    private costCapEnforcer: CostCapEnforcer,
    private usageCountersService: UsageCountersService,
    private env: ServerEnv
  ) {}

  async list(actor: Actor, conversationId: string) {
    await this.conversationsService.assertOwns(actor, conversationId);
    return this.messagesRepository.listForConversation(conversationId);
  }

  private estimatedTurnBudget() {
    return {
      estimatedTokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS * 2,
      estimatedCostUsd: 0
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
      await this.createBlockedMessage(actor, input.conversationId, 'model_disabled');
      throw new HttpException(429, 'Advisor model is disabled', 'model_disabled');
    }

    await this.costCapEnforcer.assertAllowed({
      userId: actor.id,
      ...this.estimatedTurnBudget()
    });

    const prompt = await this.promptFetcher.fetchPrompt(advisorId);
    const dna = await this.dnaDigestGenerator.getDigest();

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

    const userMessage = await this.messagesRepository.create({
      conversationId: input.conversationId,
      userId: actor.id,
      role: 'user',
      content: input.content,
      status: 'ok'
    });

    const request: LlmChatRequest = {
      provider: config.provider,
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `${prompt.text}\n${dna.digest}`
        },
        ...history,
        { role: 'user', content: input.content }
      ]
    };

    return {
      request,
      userMessage,
      provider: config.provider,
      model: config.model,
      promptDocRevision: prompt.revision,
      dnaDigestVersion: dna.version
    };
  }

  private async createBlockedMessage(
    actor: Actor,
    conversationId: string,
    blockReason: string
  ) {
    return this.messagesRepository.create({
      conversationId,
      userId: actor.id,
      role: 'assistant',
      content: 'Request blocked.',
      status: 'blocked',
      blockReason
    });
  }

  private async persistAssistantTurn(
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
    const assistantMessage = await this.messagesRepository.create({
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
    });

    await this.usageCountersService.incrementTurn(actor.id, {
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      estimatedCostUsd: Number(completion.estimatedCostUsd)
    });

    return assistantMessage;
  }

  async chatTurn(
    actor: Actor,
    input: { conversationId: string; content: string }
  ) {
    try {
      const prepared = await this.prepareTurn(actor, input);
      const completion = await this.llmProvider.complete(prepared.request);

      const assistantMessage = await this.persistAssistantTurn(
        actor,
        input.conversationId,
        prepared,
        completion
      );

      return { userMessage: prepared.userMessage, assistantMessage };
    } catch (error) {
      if (error instanceof HttpException) {
        if (error.code !== 'model_disabled') {
          await this.createBlockedMessage(actor, input.conversationId, error.code);
        }
      }
      throw error;
    }
  }

  async *streamChatTurn(
    actor: Actor,
    input: { conversationId: string; content: string }
  ) {
    let prepared: Awaited<ReturnType<MessagesService['prepareTurn']>> | undefined;

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

      const assistantMessage = await this.persistAssistantTurn(
        actor,
        input.conversationId,
        prepared,
        completion
      );

      yield {
        type: 'final' as const,
        data: {
          userMessage: prepared.userMessage,
          assistantMessage
        }
      };
    } catch (error) {
      if (prepared) {
        await this.messagesRepository.create({
          conversationId: input.conversationId,
          userId: actor.id,
          role: 'assistant',
          content: 'Stream failed.',
          provider: prepared.provider,
          model: prepared.model,
          status: 'error',
          blockReason:
            error instanceof Error && 'code' in error
              ? String(error.code)
              : 'chat_stream_error',
          promptDocRevision: prepared.promptDocRevision,
          dnaDigestVersion: prepared.dnaDigestVersion
        });
      }

      throw error;
    }
  }
}
