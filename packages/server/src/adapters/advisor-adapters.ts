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
