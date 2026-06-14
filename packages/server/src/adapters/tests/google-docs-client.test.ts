import { describe, expect, test } from 'bun:test';

import type { ServerEnv } from '../../config/env';
import { GoogleDocsClient } from '../advisor-adapters';

const docFixture = {
  revisionId: 'rev123',
  body: {
    content: [
      {
        paragraph: {
          elements: [{ textRun: { content: 'Hello from Google Docs' } }]
        }
      }
    ]
  }
};

const baseEnv = {
  GOOGLE_REFRESH_TOKEN: 'refresh_token_test',
  GOOGLE_CLIENT_ID: 'client_id_test',
  GOOGLE_CLIENT_SECRET: 'client_secret_test'
} as unknown as ServerEnv;

describe('GoogleDocsClient', () => {
  test('happy path — exchanges refresh token and fetches document', async () => {
    let capturedTokenUrl = '';
    let capturedDocsAuthHeader = '';
    let callIndex = 0;

    const original = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      callIndex++;
      const urlStr = url.toString();

      if (urlStr.includes('oauth2.googleapis.com')) {
        capturedTokenUrl = urlStr;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'ya29.test', expires_in: 3599 })
        } as unknown as Response;
      }

      capturedDocsAuthHeader =
        (init?.headers as Record<string, string>)?.['Authorization'] ?? '';
      return {
        ok: true,
        status: 200,
        json: async () => docFixture
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const client = new GoogleDocsClient(baseEnv);
      const result = await client.fetchDocument('docId123');

      expect(capturedTokenUrl).toBe('https://oauth2.googleapis.com/token');
      expect(capturedDocsAuthHeader).toBe('Bearer ya29.test');
      expect(result.text).toBe('Hello from Google Docs');
      expect(result.revision).toBe('rev123');
      expect(callIndex).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });

  test('token exchange failure — throws docs_auth_failed', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' })
      }) as unknown as Response) as unknown as typeof fetch;

    try {
      const client = new GoogleDocsClient(baseEnv);
      await expect(client.fetchDocument('docId123')).rejects.toMatchObject({
        code: 'docs_auth_failed',
        status: 503
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  test('missing credentials — throws docs_not_configured', async () => {
    const envWithoutToken = {
      ...baseEnv,
      GOOGLE_REFRESH_TOKEN: ''
    } as unknown as ServerEnv;

    const client = new GoogleDocsClient(envWithoutToken);
    await expect(client.fetchDocument('docId123')).rejects.toMatchObject({
      code: 'docs_not_configured',
      status: 503
    });
  });

  test('access token is cached and reused on second call', async () => {
    let tokenCallCount = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('oauth2.googleapis.com')) {
        tokenCallCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'ya29.cached', expires_in: 3599 })
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => docFixture
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const client = new GoogleDocsClient(baseEnv);
      await client.fetchDocument('doc1');
      await client.fetchDocument('doc2');
      expect(tokenCallCount).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
