import { describe, expect, test } from 'bun:test';

import { streamChatTurn } from './api';

describe('chat stream API', () => {
  test('passes abort signals to the SSE fetch request', async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let init: RequestInit | undefined;

    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      requestInit?: RequestInit
    ) => {
      init = requestInit;
      return new Response(
        new ReadableStream({
          start(streamController) {
            streamController.close();
          }
        })
      );
    }) as typeof fetch;

    try {
      await streamChatTurn(
        { advisorId: 'advisor-1', content: 'Hello' },
        () => undefined,
        { signal: controller.signal }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(init?.signal).toBe(controller.signal);
    expect(init?.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    });
  });
});
