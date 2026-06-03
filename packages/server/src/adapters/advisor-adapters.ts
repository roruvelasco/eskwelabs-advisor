export interface PromptSnapshot {
  text: string;
  revision: string;
  hash: string;
}

export interface DnaDigestSnapshot {
  digest: string;
  version: string;
  hash: string;
}

export interface GoogleDocsPromptFetcher {
  fetchPrompt(advisorId: string): Promise<PromptSnapshot>;
}

export interface DnaDigestGenerator {
  getDigest(): Promise<DnaDigestSnapshot>;
}

export interface LlmChatRequest {
  provider: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export interface LlmChatResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estimatedCostUsd: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: string;
}

export type LlmChatChunk =
  | { type: 'delta'; content: string }
  | { type: 'done'; usage: LlmUsage; finishReason?: string };

export interface LlmProvider {
  complete(request: LlmChatRequest): Promise<LlmChatResponse>;
  stream(request: LlmChatRequest): AsyncGenerator<LlmChatChunk>;
}

export class DeterministicPromptFetcher implements GoogleDocsPromptFetcher {
  async fetchPrompt(advisorId: string) {
    return {
      text: `System instructions for ${advisorId}`,
      revision: 'deterministic-revision',
      hash: `prompt:${advisorId}:deterministic`
    };
  }
}

export class DeterministicDnaDigestGenerator implements DnaDigestGenerator {
  private static readonly CACHE_TTL_MS = 300_000;
  private static cache:
    | { snapshot: DnaDigestSnapshot; expiresAt: number }
    | undefined;

  async getDigest() {
    if (
      DeterministicDnaDigestGenerator.cache &&
      DeterministicDnaDigestGenerator.cache.expiresAt > Date.now()
    ) {
      return DeterministicDnaDigestGenerator.cache.snapshot;
    }

    const snapshot = {
      digest: 'DNA digest for all advisors',
      version: 'deterministic-dna-v1',
      hash: 'dna:digest:deterministic'
    };

    DeterministicDnaDigestGenerator.cache = {
      snapshot,
      expiresAt: Date.now() + DeterministicDnaDigestGenerator.CACHE_TTL_MS
    };

    return snapshot;
  }
}

export class DeterministicLlmProvider implements LlmProvider {
  async complete(request: LlmChatRequest) {
    const userMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');

    return {
      content: `Draft response for: ${userMessage?.content ?? 'empty turn'}`,
      promptTokens: 100,
      completionTokens: 50,
      latencyMs: 1,
      estimatedCostUsd: '0.0001'
    };
  }

  async *stream(request: LlmChatRequest): AsyncGenerator<LlmChatChunk> {
    const response = await this.complete(request);
    const words = response.content.split(' ');

    for (const word of words) {
      yield { type: 'delta', content: `${word} ` };
    }

    yield {
      type: 'done',
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.promptTokens + response.completionTokens,
        estimatedCostUsd: response.estimatedCostUsd
      },
      finishReason: 'stop'
    };
  }
}
