import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { createAuthMiddleware, requireActor } from './auth.middleware';
import { errorHandler } from './error.middleware';
import type { HonoEnv } from '../utils/hono';
import type { User } from '../../users/users.schema';

const TEST_SECRET = 'test-forwarding-secret-min-16';

async function signHeaders(
  actor: { id: string; email: string; role: string; isActive: boolean },
  method: string,
  path: string,
  secret: string = TEST_SECRET
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const payload = `${actor.id}:${actor.email}:${actor.role}:${actor.isActive}:${method}:${path}:${timestamp}:${nonce}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return { signature, timestamp, nonce };
}

async function buildSignedHeaders(
  actor: { id: string; email: string; role: string; isActive: boolean },
  method = 'GET',
  path = '/eif',
  secret?: string
) {
  const sig = await signHeaders(actor, method, path, secret);
  return {
    'x-eskwelabs-actor-id': actor.id,
    'x-eskwelabs-actor-email': actor.email,
    'x-eskwelabs-actor-role': actor.role,
    'x-eskwelabs-actor-active': String(actor.isActive),
    'x-eskwelabs-actor-signature': sig.signature,
    'x-eskwelabs-actor-timestamp': sig.timestamp,
    'x-eskwelabs-actor-nonce': sig.nonce
  };
}

describe('auth middleware', () => {
  const user: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'eif@example.com',
    passwordHash: null,
    role: 'eif',
    isActive: true,
    consentAcknowledgedAt: null,
    createdAt: new Date(0)
  };

  function appFor(users: User[], env?: { ACTOR_FORWARDING_SECRET: string }) {
    const app = new Hono<HonoEnv>();
    app.onError(errorHandler);
    app.use(
      '*',
      createAuthMiddleware(
        {
          findById: async (id: string) => users.find((row) => row.id === id)
        } as never,
        env
      )
    );
    app.get('/admin', requireActor(['admin']), (c) => c.json({ ok: true }));
    app.get('/eif', requireActor(['eif']), (c) => c.json({ ok: true }));
    return app;
  }

  test('uses database role instead of spoofed forwarded role', async () => {
    const headers = await buildSignedHeaders(
      {
        id: user.id,
        email: user.email,
        role: 'admin',
        isActive: true
      },
      'GET',
      '/admin'
    );

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/admin', { headers });

    expect(response.status).toBe(403);
  });

  test('rejects mismatched id/email headers', async () => {
    const headers = await buildSignedHeaders({
      id: user.id,
      email: 'other@example.com',
      role: 'eif',
      isActive: true
    });

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', { headers });

    expect(response.status).toBe(401);
  });

  test('rejects inactive database users', async () => {
    const headers = await buildSignedHeaders({
      id: user.id,
      email: user.email,
      role: 'eif',
      isActive: true
    });

    const response = await appFor([{ ...user, isActive: false }], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', { headers });

    expect(response.status).toBe(401);
  });

  test('rejects unsigned actor headers when secret is configured', async () => {
    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', {
      headers: {
        'x-eskwelabs-actor-id': user.id,
        'x-eskwelabs-actor-email': user.email,
        'x-eskwelabs-actor-role': 'eif',
        'x-eskwelabs-actor-active': 'true'
      }
    });

    expect(response.status).toBe(401);
  });

  test('rejects invalid signature', async () => {
    const headers = await buildSignedHeaders(
      {
        id: user.id,
        email: user.email,
        role: 'eif',
        isActive: true
      },
      'GET',
      '/eif',
      TEST_SECRET
    );

    headers['x-eskwelabs-actor-signature'] = btoa('wrong-signature-data');

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', { headers });

    expect(response.status).toBe(401);
  });

  test('rejects stale timestamp', async () => {
    const actor = {
      id: user.id,
      email: user.email,
      role: 'eif' as const,
      isActive: true
    };
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const payload = `${actor.id}:${actor.email}:${actor.role}:${actor.isActive}:GET:/eif:${staleTimestamp}:${nonce}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(TEST_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', {
      headers: {
        'x-eskwelabs-actor-id': user.id,
        'x-eskwelabs-actor-email': user.email,
        'x-eskwelabs-actor-role': 'eif',
        'x-eskwelabs-actor-active': 'true',
        'x-eskwelabs-actor-signature': signature,
        'x-eskwelabs-actor-timestamp': String(staleTimestamp),
        'x-eskwelabs-actor-nonce': nonce
      }
    });

    expect(response.status).toBe(401);
  });

  test('accepts valid signed headers and resolves actor from DB', async () => {
    const headers = await buildSignedHeaders({
      id: user.id,
      email: user.email,
      role: 'eif',
      isActive: true
    });

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/eif', { headers });

    expect(response.status).toBe(200);
  });

  test('signed forwarded role cannot override DB role', async () => {
    const headers = await buildSignedHeaders(
      {
        id: user.id,
        email: user.email,
        role: 'admin',
        isActive: true
      },
      'GET',
      '/admin'
    );

    const response = await appFor([user], {
      ACTOR_FORWARDING_SECRET: TEST_SECRET
    }).request('/admin', { headers });

    expect(response.status).toBe(403);
  });
});
