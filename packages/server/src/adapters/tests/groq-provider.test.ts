import { describe, expect, test } from 'bun:test';

import { HttpException } from '../../common/http/http-exception';
import type { ServerEnv } from '../../config/env';
import {
  GroqLlmProvider,
  RoutingLlmProvider,
  GeminiLlmProvider,
  DeterministicLlmProvider
} from '../advisor-adapters';
import {
  getModelRate,
  estimateModelCostUsd
} from '../../usage-counters/model-rates';

interface MockResponse {
  status?: number;
  headers?: Record<string, string>;
  json?: unknown;
  text?: string;
  body?: ReadableStream | null;
}

const baseEnv = {
  GROQ_API_KEY: 'gsk_test_key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  PROVIDER_TIMEOUT_MS: 60_000,
  DEFAULT_MAX_OUTPUT_TOKENS: 2000
} as ServerEnv;

const baseRequest = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system' as const, content: 'You are a helpful advisor.' },
    { role: 'user' as const, content: 'Hello' }
  ]
};

function mockFetch(response: MockResponse) {
  const ok = response.status
    ? response.status >= 200 && response.status < 300
    : true;
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok,
      status: response.status ?? 200,
      headers: new Map(Object.entries(response.headers ?? {})),
      json: async () => response.json,
      text: async () => response.text ?? '',
      body: response.body ?? null
    }) as unknown as Response) as unknown as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

function mockFetchSequence(responses: Array<MockResponse>) {
  const original = globalThis.fetch;
  let callIndex = 0;
  globalThis.fetch = (async () => {
    const response =
      responses[callIndex] ?? responses[responses.length - 1] ?? {};
    const ok = response.status
      ? response.status >= 200 && response.status < 300
      : true;
    callIndex++;
    return {
      ok,
      status: response.status ?? 200,
      headers: new Map(Object.entries(response.headers ?? {})),
      json: async () => response.json,
      text: async () => response.text ?? '',
      body: response.body ?? null
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

class ControlledStream {
  private controller!: ReadableStreamDefaultController;
  public stream: ReadableStream<Uint8Array>;

  constructor() {
    this.stream = new ReadableStream({
      start: (c) => {
        this.controller = c;
      }
    });
  }

  write(text: string) {
    this.controller.enqueue(new TextEncoder().encode(text));
  }

  close() {
    this.controller.close();
  }

  error(err: unknown) {
    this.controller.error(err);
  }
}

describe('GroqLlmProvider', () => {
  describe('complete()', () => {
    test('sends bearer token and correct endpoint', async () => {
      let capturedUrl = '';
      let capturedHeaders: Record<string, string> = {};

      const restore = mockFetch({
        json: {
          id: 'chat-1',
          choices: [
            {
              message: { content: 'Hello! How can I help?' },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        }
      });

      globalThis.fetch = (async (
        url: RequestInfo | URL,
        init?: RequestInit
      ) => {
        capturedUrl = url.toString();
        capturedHeaders = (init?.headers as Record<string, string>) ?? {};
        return {
          ok: true,
          status: 200,
          headers: new Map(),
          json: async () => ({
            id: 'chat-1',
            choices: [
              {
                message: { content: 'Hello! How can I help?' },
                finish_reason: 'stop'
              }
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          }),
          text: async () => ''
        } as unknown as Response;
      }) as unknown as typeof fetch;

      try {
        const provider = new GroqLlmProvider(baseEnv);
        await provider.complete(baseRequest);

        expect(capturedUrl).toBe(
          'https://api.groq.com/openai/v1/chat/completions'
        );
        expect(capturedHeaders['Authorization']).toBe('Bearer gsk_test_key');
        expect(capturedHeaders['Content-Type']).toBe('application/json');
      } finally {
        restore();
      }
    });

    test('sends provider-selected model', async () => {
      let capturedBody = '';

      const restore = mockFetch({
        json: {
          id: 'chat-1',
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        }
      });

      globalThis.fetch = (async (
        _url: RequestInfo | URL,
        init?: RequestInit
      ) => {
        capturedBody = (init?.body as string) ?? '';
        return {
          ok: true,
          status: 200,
          headers: new Map(),
          json: async () => ({
            id: 'chat-1',
            choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }),
          text: async () => ''
        } as unknown as Response;
      }) as unknown as typeof fetch;

      try {
        const provider = new GroqLlmProvider(baseEnv);
        await provider.complete(baseRequest);

        const body = JSON.parse(capturedBody);
        expect(body.model).toBe('llama-3.3-70b-versatile');
        expect(body.messages).toHaveLength(2);
        expect(body.messages[0].role).toBe('system');
        expect(body.messages[1].content).toBe('Hello');
      } finally {
        restore();
      }
    });

    test('maps content and token usage correctly', async () => {
      const restore = mockFetch({
        json: {
          id: 'chat-1',
          choices: [
            {
              message: { content: 'Here is my response.' },
              finish_reason: 'stop'
            }
          ],
          usage: { prompt_tokens: 25, completion_tokens: 12, total_tokens: 37 }
        }
      });

      try {
        const provider = new GroqLlmProvider(baseEnv);
        const result = await provider.complete(baseRequest);

        expect(result.content).toBe('Here is my response.');
        expect(result.promptTokens).toBe(25);
        expect(result.completionTokens).toBe(12);
        expect(typeof result.latencyMs).toBe('number');
        expect(typeof result.estimatedCostUsd).toBe('string');
      } finally {
        restore();
      }
    });

    test('calculates cost through the shared helper', async () => {
      const restore = mockFetch({
        json: {
          id: 'chat-1',
          choices: [
            { message: { content: 'Cost test' }, finish_reason: 'stop' }
          ],
          usage: {
            prompt_tokens: 1000000,
            completion_tokens: 1000000,
            total_tokens: 2000000
          }
        }
      });

      try {
        const provider = new GroqLlmProvider(baseEnv);
        const result = await provider.complete(baseRequest);

        const expectedCost = estimateModelCostUsd({
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          promptTokens: 1000000,
          completionTokens: 1000000
        });

        expect(Number(result.estimatedCostUsd)).toBeCloseTo(
          expectedCost ?? 0,
          4
        );
      } finally {
        restore();
      }
    });

    test('handles malformed success response', async () => {
      const restore = mockFetch({
        json: {
          id: 'chat-1',
          choices: []
        }
      });

      try {
        const provider = new GroqLlmProvider(baseEnv);
        await expect(provider.complete(baseRequest)).rejects.toThrow(
          HttpException
        );
      } finally {
        restore();
      }
    });

    test('maps 401 safely', async () => {
      const restore = mockFetch({
        status: 401,
        json: { error: { message: 'Invalid API key' } }
      });

      try {
        const provider = new GroqLlmProvider(baseEnv);
        await expect(provider.complete(baseRequest)).rejects.toMatchObject({
          status: 502,
          code: 'provider_auth_error'
        });
      } finally {
        restore();
      }
    });

    test('maps 404 safely', async () => {
      const restore = mockFetch({
        status: 404,
        json: { error: { message: 'Model not found' } }
      });

      try {
        const provider = new GroqLlmProvider(baseEnv);
        await expect(provider.complete(baseRequest)).rejects.toMatchObject({
          status: 502,
          code: 'provider_model_error'
        });
      } finally {
        restore();
      }
    });

    test('handles 429 with bounded retry', async () => {
      let callCount = 0;

      const restore = mockFetchSequence([
        {
          status: 429,
          headers: { 'retry-after': '0' },
          json: { error: { message: 'Rate limited' } }
        },
        {
          json: {
            id: 'chat-2',
            choices: [
              { message: { content: 'Retry worked' }, finish_reason: 'stop' }
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }
        }
      ]);

      try {
        globalThis.fetch = (async () => {
          callCount++;
          if (callCount === 1) {
            return {
              ok: false,
              status: 429,
              headers: new Map([['retry-after', '0']]),
              json: async () => ({ error: { message: 'Rate limited' } }),
              text: async () => ''
            } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({
              id: 'chat-2',
              choices: [
                { message: { content: 'Retry worked' }, finish_reason: 'stop' }
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            }),
            text: async () => ''
          } as unknown as Response;
        }) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const result = await provider.complete(baseRequest);
        expect(result.content).toBe('Retry worked');
        expect(callCount).toBe(2);
      } finally {
        restore();
      }
    });

    test('respects retry-after header', async () => {
      let callCount = 0;
      const startTime = Date.now();

      const restore = mockFetchSequence([
        {
          status: 429,
          headers: { 'retry-after': '1' },
          json: { error: { message: 'Rate limited' } }
        },
        {
          json: {
            id: 'chat-3',
            choices: [
              { message: { content: 'Delayed retry' }, finish_reason: 'stop' }
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
          }
        }
      ]);

      try {
        globalThis.fetch = (async () => {
          callCount++;
          if (callCount === 1) {
            return {
              ok: false,
              status: 429,
              headers: new Map([['retry-after', '1']]),
              json: async () => ({ error: { message: 'Rate limited' } }),
              text: async () => ''
            } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({
              id: 'chat-3',
              choices: [
                { message: { content: 'Delayed retry' }, finish_reason: 'stop' }
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            }),
            text: async () => ''
          } as unknown as Response;
        }) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const result = await provider.complete(baseRequest);
        const elapsed = Date.now() - startTime;
        expect(result.content).toBe('Delayed retry');
        expect(elapsed).toBeGreaterThanOrEqual(900);
      } finally {
        restore();
      }
    });
  });

  describe('stream()', () => {
    test('parses multiple SSE text chunks', async () => {
      const stream = new ControlledStream();
      const restore = mockFetch({
        body: stream.stream
      });

      try {
        globalThis.fetch = (async () =>
          ({
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({}),
            text: async () => '',
            body: stream.stream
          }) as unknown as Response) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const chunks: string[] = [];
        const gen = provider.stream(baseRequest);

        stream.write(
          'data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n'
        );
        stream.write(
          'data: {"choices":[{"delta":{"content":" world"},"index":0}]}\n\n'
        );
        stream.write(
          'data: {"choices":[{"delta":{"content":"!"},"index":0}]}\n\n'
        );
        stream.write('data: [DONE]\n\n');
        stream.close();

        for await (const chunk of gen) {
          if (chunk.type === 'delta') chunks.push(chunk.content);
        }

        expect(chunks).toEqual(['Hello', ' world', '!']);
      } finally {
        restore();
      }
    });

    test('stops at [DONE]', async () => {
      const stream = new ControlledStream();
      const restore = mockFetch({
        body: stream.stream
      });

      try {
        globalThis.fetch = (async () =>
          ({
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({}),
            text: async () => '',
            body: stream.stream
          }) as unknown as Response) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const chunks: string[] = [];
        let finalUsage: unknown = null;
        const gen = provider.stream(baseRequest);

        stream.write(
          'data: {"choices":[{"delta":{"content":"Only"},"index":0}]}\n\n'
        );
        stream.write('data: [DONE]\n\n');
        stream.write(
          'data: {"choices":[{"delta":{"content":"IGNORED"},"index":0}]}\n\n'
        );
        stream.close();

        for await (const chunk of gen) {
          if (chunk.type === 'delta') chunks.push(chunk.content);
          if (chunk.type === 'done') finalUsage = chunk.usage;
        }

        expect(chunks).toEqual(['Only']);
        expect(finalUsage).not.toBeNull();
      } finally {
        restore();
      }
    });

    test('ignores empty deltas', async () => {
      const stream = new ControlledStream();
      const restore = mockFetch({
        body: stream.stream
      });

      try {
        globalThis.fetch = (async () =>
          ({
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({}),
            text: async () => '',
            body: stream.stream
          }) as unknown as Response) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const chunks: string[] = [];
        const gen = provider.stream(baseRequest);

        stream.write('data: {"choices":[{"delta":{},"index":0}]}\n\n');
        stream.write(
          'data: {"choices":[{"delta":{"content":"Real"},"index":0}]}\n\n'
        );
        stream.write('data: {"choices":[{"delta":{},"index":0}]}\n\n');
        stream.write('data: [DONE]\n\n');
        stream.close();

        for await (const chunk of gen) {
          if (chunk.type === 'delta') chunks.push(chunk.content);
        }

        expect(chunks).toEqual(['Real']);
      } finally {
        restore();
      }
    });

    test('rejects malformed upstream stream safely', async () => {
      const restore = mockFetch({
        status: 401,
        json: { error: { message: 'Unauthorized' } }
      });

      try {
        globalThis.fetch = (async () =>
          ({
            ok: false,
            status: 401,
            headers: new Map(),
            json: async () => ({ error: { message: 'Unauthorized' } }),
            text: async () => '',
            body: null
          }) as unknown as Response) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        const gen = provider.stream(baseRequest);
        await expect(gen.next()).rejects.toMatchObject({
          status: 502,
          code: 'provider_stream_failed'
        });
      } finally {
        restore();
      }
    });

    test('throws if GROQ_API_KEY is missing', async () => {
      const env = { ...baseEnv, GROQ_API_KEY: '' } as ServerEnv;
      const provider = new GroqLlmProvider(env);

      await expect(provider.complete(baseRequest)).rejects.toMatchObject({
        code: 'groq_not_configured'
      });

      const gen = provider.stream(baseRequest);
      await expect(gen.next()).rejects.toMatchObject({
        code: 'groq_not_configured'
      });
    });

    test('includes usage from stream chunks in final done event', async () => {
      const stream = new ControlledStream();
      const restore = mockFetch({
        body: stream.stream
      });

      try {
        globalThis.fetch = (async () =>
          ({
            ok: true,
            status: 200,
            headers: new Map(),
            json: async () => ({}),
            text: async () => '',
            body: stream.stream
          }) as unknown as Response) as unknown as typeof fetch;

        const provider = new GroqLlmProvider(baseEnv);
        let finalDone:
          | { usage: { promptTokens: number; completionTokens: number } }
          | undefined;
        const gen = provider.stream(baseRequest);

        stream.write(
          'data: {"choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}],"usage":{"prompt_tokens":10,"completion_tokens":0,"total_tokens":10}}\n\n'
        );
        stream.write(
          'data: {"choices":[{"delta":{"content":" world"},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n'
        );
        stream.write('data: [DONE]\n\n');
        stream.close();

        for await (const chunk of gen) {
          if (chunk.type === 'done') finalDone = chunk;
        }

        expect(finalDone?.usage.promptTokens).toBe(10);
        expect(finalDone?.usage.completionTokens).toBe(5);
      } finally {
        restore();
      }
    });
  });
});

describe('RoutingLlmProvider', () => {
  test('routes provider=groq to Groq', async () => {
    let capturedProvider = '';
    const groqProvider = {
      complete: async (req: { provider: string }) => {
        capturedProvider = req.provider;
        return {
          content: 'groq response',
          promptTokens: 1,
          completionTokens: 1,
          latencyMs: 1,
          estimatedCostUsd: '0.000001'
        };
      },
      stream: async function* () {}
    } as unknown as GroqLlmProvider;

    const providers = new Map([['groq', groqProvider]]);
    const router = new RoutingLlmProvider(providers);

    const result = await router.complete({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: []
    });

    expect(capturedProvider).toBe('groq');
    expect(result.content).toBe('groq response');
  });

  test('routes provider=gemini to Gemini', async () => {
    let capturedProvider = '';
    const geminiProvider = {
      complete: async (req: { provider: string }) => {
        capturedProvider = req.provider;
        return {
          content: 'gemini response',
          promptTokens: 2,
          completionTokens: 2,
          latencyMs: 2,
          estimatedCostUsd: '0.000002'
        };
      },
      stream: async function* () {}
    } as unknown as GeminiLlmProvider;

    const providers = new Map([['gemini', geminiProvider]]);
    const router = new RoutingLlmProvider(providers);

    const result = await router.complete({
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      messages: []
    });

    expect(capturedProvider).toBe('gemini');
    expect(result.content).toBe('gemini response');
  });

  test('rejects an unconfigured provider safely', async () => {
    const providers = new Map([
      ['deterministic', new DeterministicLlmProvider()]
    ]);
    const router = new RoutingLlmProvider(providers);

    await expect(
      router.complete({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: []
      })
    ).rejects.toMatchObject({
      code: 'llm_provider_unavailable',
      status: 503
    });
  });

  test('does not silently cross-fallback', async () => {
    const providers = new Map([
      ['gemini', new GeminiLlmProvider({ GEMINI_API_KEY: '' } as ServerEnv)]
    ]);
    const router = new RoutingLlmProvider(providers);

    await expect(
      router.complete({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: []
      })
    ).rejects.toMatchObject({
      code: 'llm_provider_unavailable'
    });
  });

  test('forwards stream requests to the correct provider', async () => {
    const streamResults = ['a', 'b'];
    const mockProvider = {
      complete: async () => {
        throw new Error('should not be called');
      },
      stream: async function* () {
        for (const s of streamResults) {
          yield { type: 'delta' as const, content: s };
        }
        yield {
          type: 'done' as const,
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            estimatedCostUsd: '0'
          },
          finishReason: 'stop'
        };
      }
    };

    const providers = new Map([['groq', mockProvider]]);
    const router = new RoutingLlmProvider(providers);

    const chunks: string[] = [];
    for await (const chunk of router.stream({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      messages: []
    })) {
      if (chunk.type === 'delta') chunks.push(chunk.content);
    }

    expect(chunks).toEqual(['a', 'b']);
  });
});

describe('Groq model rates', () => {
  test('estimates Groq model cost correctly', () => {
    const cost = estimateModelCostUsd({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      promptTokens: 1_000_000,
      completionTokens: 1_000_000
    });

    expect(cost).toBeCloseTo(0.59 + 0.79, 4);
  });

  test('estimates cheap Groq model cost correctly', () => {
    const cost = estimateModelCostUsd({
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      promptTokens: 1_000_000,
      completionTokens: 500_000
    });

    expect(cost).toBeCloseTo(0.05 + 0.04, 4);
  });

  test('returns null for unknown Groq model', () => {
    const cost = estimateModelCostUsd({
      provider: 'groq',
      model: 'unknown-model',
      promptTokens: 100,
      completionTokens: 50
    });

    expect(cost).toBeNull();
  });

  test('preserves Gemini rates', () => {
    const geminiCost = estimateModelCostUsd({
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      promptTokens: 1_000_000,
      completionTokens: 500_000
    });

    expect(geminiCost).toBeCloseTo(0.1 + 0.2, 4);

    const deterministicCost = estimateModelCostUsd({
      provider: 'deterministic',
      model: 'deterministic-model',
      promptTokens: 100,
      completionTokens: 50
    });

    expect(deterministicCost).toBe(0);
  });

  test('getModelRate finds Groq rates', () => {
    const rate = getModelRate('groq', 'llama-3.3-70b-versatile');
    expect(rate).toBeDefined();
    expect(rate?.inputUsdPerMillionTokens).toBe(0.59);
    expect(rate?.outputUsdPerMillionTokens).toBe(0.79);
  });
});
