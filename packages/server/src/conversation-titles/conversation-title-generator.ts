import type {
  LlmProvider,
  LlmChatResponse
} from '../adapters/advisor-adapters';
import { normalizeGeneratedConversationTitle } from './conversation-title-normalizer';
import {
  FIXED_TITLE_PROMPT,
  TITLE_TRANSCRIPT_MAX_CHARS
} from './title-generation.constants';

export class InvalidGeneratedConversationTitleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGeneratedConversationTitleError';
  }
}

export interface GenerateConversationTitleInput {
  provider: string;
  model: string;
  firstUserMessage: string;
  firstAssistantMessage: string;
}

export interface GeneratedConversationTitle {
  title: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: string;
}

export class ConversationTitleGenerator {
  constructor(private llmProvider: LlmProvider) {}

  async generate(
    input: GenerateConversationTitleInput
  ): Promise<GeneratedConversationTitle> {
    const response: LlmChatResponse = await this.llmProvider.complete({
      provider: input.provider,
      model: input.model,
      messages: [
        { role: 'system', content: FIXED_TITLE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            firstUserMessage: input.firstUserMessage.slice(
              0,
              TITLE_TRANSCRIPT_MAX_CHARS
            ),
            firstAssistantMessage: input.firstAssistantMessage.slice(
              0,
              TITLE_TRANSCRIPT_MAX_CHARS
            )
          })
        }
      ]
    });

    const title = normalizeGeneratedConversationTitle(response.content);

    if (!title) {
      throw new InvalidGeneratedConversationTitleError(
        'LLM returned an invalid conversation title'
      );
    }

    return {
      title,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd
    };
  }
}
