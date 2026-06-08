import { createHash, createSign } from 'node:crypto';

import { HttpException } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';
import {
  estimateModelCostUsd,
  formatEstimatedCostUsd
} from '../usage-counters/model-rates';

export interface DnaDigestSummarizer {
  summarize(text: string): Promise<string>;
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

const DOCS_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function extractGoogleDocText(document: GoogleDocumentResponse) {
  return (
    document.body?.content
      ?.flatMap(
        (block) =>
          block.paragraph?.elements?.map(
            (element) => element.textRun?.content ?? ''
          ) ?? []
      )
      .join('')
      .trim() ?? ''
  );
}

type GoogleDocumentResponse = {
  revisionId?: string;
  body?: {
    content?: Array<{
      paragraph?: {
        elements?: Array<{
          textRun?: { content?: string };
        }>;
      };
    }>;
  };
};

export class GoogleDocsClient {
  private accessToken?: { value: string; expiresAt: number };

  constructor(private env: ServerEnv) {}

  private get serviceAccount() {
    if (!this.env.GOOGLE_DOCS_SERVICE_ACCOUNT_JSON) return null;
    try {
      return JSON.parse(this.env.GOOGLE_DOCS_SERVICE_ACCOUNT_JSON) as {
        client_email?: string;
        private_key?: string;
        token_uri?: string;
      };
    } catch {
      throw new HttpException(
        500,
        'Google Docs service account is invalid',
        'docs_auth_invalid'
      );
    }
  }

  private async getAccessToken() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }

    const serviceAccount = this.serviceAccount;
    if (serviceAccount?.client_email && serviceAccount.private_key) {
      const tokenUri =
        serviceAccount.token_uri ?? 'https://oauth2.googleapis.com/token';
      const now = Math.floor(Date.now() / 1000);
      const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const claim = base64Url(
        JSON.stringify({
          iss: serviceAccount.client_email,
          scope: DOCS_SCOPE,
          aud: tokenUri,
          exp: now + 3600,
          iat: now
        })
      );
      const signature = createSign('RSA-SHA256')
        .update(`${header}.${claim}`)
        .sign(serviceAccount.private_key);
      const assertion = `${header}.${claim}.${base64Url(signature)}`;

      const response = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion
        })
      });

      if (!response.ok) {
        throw new HttpException(
          503,
          'Google Docs authentication failed',
          'docs_auth_failed'
        );
      }

      const payload = (await response.json()) as {
        access_token: string;
        expires_in?: number;
      };
      this.accessToken = {
        value: payload.access_token,
        expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000
      };
      return this.accessToken.value;
    }

    throw new HttpException(
      503,
      'Google Docs service account is not configured',
      'docs_not_configured'
    );
  }

  async fetchDocument(docId: string) {
    const url = new URL(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`
    );
    url.searchParams.set(
      'fields',
      'revisionId,body/content/paragraph/elements/textRun/content'
    );

    const token = await this.getAccessToken();

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new HttpException(
        503,
        'Google Doc could not be fetched',
        'docs_fetch_failed'
      );
    }

    const document = (await response.json()) as GoogleDocumentResponse;
    const text = extractGoogleDocText(document);

    if (!text) {
      throw new HttpException(503, 'Google Doc is empty', 'docs_empty');
    }

    return {
      text,
      revision: document.revisionId ?? sha256(text)
    };
  }
}

export class GoogleDocsGeminiDnaDigestGenerator implements DnaDigestSummarizer {
  constructor(
    private docsClient: GoogleDocsClient,
    private env: ServerEnv
  ) {}

  async summarize(text: string) {
    if (!this.env.GEMINI_API_KEY) {
      throw new HttpException(
        503,
        'Gemini API key is not configured',
        'gemini_not_configured'
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.env.GEMINI_MODEL
      )}:generateContent?key=${encodeURIComponent(this.env.GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Summarize this Eskwelabs DNA reference into a compact system digest for AI advisors. Preserve identity, voice, lexicon, formatting guardrails, and advisory posture. Do not add facts not present in the source.\n\n${text}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700
          }
        })
      }
    );

    if (!response.ok) {
      throw new HttpException(
        503,
        'DNA digest generation failed',
        'dna_digest_failed'
      );
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const digest = extractGeminiText(payload);
    if (!digest) {
      throw new HttpException(
        503,
        'DNA digest generation returned no content',
        'dna_digest_empty'
      );
    }

    return digest;
  }
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

function extractGeminiText(payload: GeminiGenerateResponse) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

function geminiContents(messages: LlmChatRequest['messages']) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));
}

function geminiSystemInstruction(messages: LlmChatRequest['messages']) {
  const text = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  return text ? { parts: [{ text }] } : undefined;
}

export class GeminiLlmProvider implements LlmProvider {
  constructor(private env: ServerEnv) {}

  private endpoint(
    model: string,
    method: 'generateContent' | 'streamGenerateContent'
  ) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:${method}?key=${encodeURIComponent(this.env.GEMINI_API_KEY)}`;
  }

  private body(request: LlmChatRequest) {
    return {
      systemInstruction: geminiSystemInstruction(request.messages),
      contents: geminiContents(request.messages),
      generationConfig: {
        maxOutputTokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS,
        temperature: 0.4
      }
    };
  }

  async complete(request: LlmChatRequest) {
    if (!this.env.GEMINI_API_KEY) {
      throw new HttpException(
        503,
        'Gemini API key is not configured',
        'gemini_not_configured'
      );
    }

    const startedAt = Date.now();
    const response = await fetch(
      this.endpoint(request.model, 'generateContent'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.body(request))
      }
    );

    if (!response.ok) {
      throw new HttpException(502, 'Gemini request failed', 'gemini_failed');
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const content = extractGeminiText(payload);
    const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      content,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - startedAt,
      estimatedCostUsd: formatEstimatedCostUsd(
        estimateModelCostUsd({
          provider: request.provider,
          model: request.model,
          promptTokens,
          completionTokens
        }) ?? 0
      )
    };
  }

  async *stream(request: LlmChatRequest): AsyncGenerator<LlmChatChunk> {
    if (!this.env.GEMINI_API_KEY) {
      throw new HttpException(
        503,
        'Gemini API key is not configured',
        'gemini_not_configured'
      );
    }

    const response = await fetch(
      `${this.endpoint(request.model, 'streamGenerateContent')}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.body(request))
      }
    );

    if (!response.ok || !response.body) {
      throw new HttpException(
        502,
        'Gemini stream failed',
        'gemini_stream_failed'
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: LlmUsage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).trim())
          .join('');

        if (!data || data === '[DONE]') continue;
        const payload = JSON.parse(data) as GeminiGenerateResponse;
        const content = extractGeminiText(payload);
        if (content) {
          yield { type: 'delta', content };
        }

        if (payload.usageMetadata) {
          const promptTokens = payload.usageMetadata.promptTokenCount ?? 0;
          const completionTokens =
            payload.usageMetadata.candidatesTokenCount ?? 0;
          usage = {
            promptTokens,
            completionTokens,
            totalTokens:
              payload.usageMetadata.totalTokenCount ??
              promptTokens + completionTokens,
            estimatedCostUsd: formatEstimatedCostUsd(
              estimateModelCostUsd({
                provider: request.provider,
                model: request.model,
                promptTokens,
                completionTokens
              }) ?? 0
            )
          };
        }
      }
    }

    if (!usage) {
      usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: '0'
      };
    }

    yield { type: 'done', usage, finishReason: 'stop' };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type GroqChatResponse = {
  id: string;
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

type GroqStreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export class GroqLlmProvider implements LlmProvider {
  constructor(private env: ServerEnv) {}

  private get baseUrl() {
    return this.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  }

  async complete(request: LlmChatRequest) {
    if (!this.env.GROQ_API_KEY) {
      throw new HttpException(
        503,
        'Groq API key is not configured',
        'groq_not_configured'
      );
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.env.PROVIDER_TIMEOUT_MS
    );

    try {
      const response = await this.fetchWithRetry(request, controller);
      const body = (await response.json()) as GroqChatResponse;
      const choice = body.choices?.[0];

      if (!choice?.message?.content) {
        throw new HttpException(
          502,
          'Provider returned an invalid response',
          'provider_invalid_response'
        );
      }

      const promptTokens = body.usage?.prompt_tokens ?? 0;
      const completionTokens = body.usage?.completion_tokens ?? 0;

      return {
        content: choice.message.content,
        promptTokens,
        completionTokens,
        latencyMs: Date.now() - startedAt,
        estimatedCostUsd: formatEstimatedCostUsd(
          estimateModelCostUsd({
            provider: request.provider,
            model: request.model,
            promptTokens,
            completionTokens
          }) ?? 0
        )
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new HttpException(
          504,
          'Provider request timed out',
          'provider_timeout'
        );
      }
      throw new HttpException(
        502,
        'Provider request failed',
        'provider_request_failed'
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchWithRetry(
    request: LlmChatRequest,
    controller: AbortController
  ) {
    const doFetch = () =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS,
          stream: false
        }),
        signal: controller.signal
      });

    let response = await doFetch();
    if (response.ok) return response;

    const status = response.status;
    if ([429, 500, 502, 503].includes(status)) {
      const retryAfter = response.headers.get('retry-after');
      let delay = 1_000;
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed) && parsed > 0)
          delay = Math.min(parsed * 1000, 30_000);
      }
      await sleep(delay);
      response = await doFetch();
      if (response.ok) return response;
    }

    throw await this.mapError(response);
  }

  private async mapError(response: Response) {
    switch (response.status) {
      case 401:
      case 403:
        return new HttpException(
          502,
          'Provider authentication failed',
          'provider_auth_error'
        );
      case 404:
        return new HttpException(
          502,
          'Provider model not found',
          'provider_model_error'
        );
      case 429:
        return new HttpException(
          502,
          'Provider rate limit exceeded',
          'provider_rate_limited'
        );
      default:
        if (response.status >= 500) {
          return new HttpException(
            502,
            'Provider upstream error',
            'provider_upstream_error'
          );
        }
        return new HttpException(
          502,
          'Provider request failed',
          'provider_request_failed'
        );
    }
  }

  async *stream(request: LlmChatRequest): AsyncGenerator<LlmChatChunk> {
    if (!this.env.GROQ_API_KEY) {
      throw new HttpException(
        503,
        'Groq API key is not configured',
        'groq_not_configured'
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.env.PROVIDER_TIMEOUT_MS
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: this.env.DEFAULT_MAX_OUTPUT_TOKENS,
          stream: true
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new HttpException(
          502,
          'Provider stream failed',
          'provider_stream_failed'
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let finishReason: string | undefined;

      let isDone = false;
      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice('data:'.length).trim();
          if (data === '[DONE]') {
            isDone = true;
            break;
          }

          try {
            const chunk = JSON.parse(data) as GroqStreamChunk;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: 'delta', content: delta };
            }

            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? 0;
              completionTokens = chunk.usage.completion_tokens ?? 0;
            }

            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          } catch {
            /* skip malformed JSON */
          }
        }
      }

      yield {
        type: 'done',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimatedCostUsd: formatEstimatedCostUsd(
            estimateModelCostUsd({
              provider: request.provider,
              model: request.model,
              promptTokens,
              completionTokens
            }) ?? 0
          )
        },
        finishReason: finishReason ?? 'stop'
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new HttpException(
          504,
          'Provider stream timed out',
          'provider_timeout'
        );
      }
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        502,
        'Provider stream failed',
        'provider_stream_failed'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class DeterministicDnaDigestSummarizer implements DnaDigestSummarizer {
  async summarize() {
    return 'DNA digest for all advisors';
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

export class RoutingLlmProvider implements LlmProvider {
  constructor(private readonly providers: Map<string, LlmProvider>) {}

  async complete(request: LlmChatRequest) {
    const provider = this.resolve(request.provider);
    return provider.complete(request);
  }

  async *stream(request: LlmChatRequest): AsyncGenerator<LlmChatChunk> {
    const provider = this.resolve(request.provider);
    yield* provider.stream(request);
  }

  private resolve(providerName: string) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new HttpException(
        503,
        `LLM provider "${providerName}" is not configured`,
        'llm_provider_unavailable'
      );
    }
    return provider;
  }
}
