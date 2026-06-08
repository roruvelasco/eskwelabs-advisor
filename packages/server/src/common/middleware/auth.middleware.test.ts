import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { createAuthMiddleware, requireActor } from './auth.middleware';
import { errorHandler } from './error.middleware';
import type { HonoEnv } from '../utils/hono';
import type { User } from '../../users/users.schema';

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

  function appFor(users: User[]) {
    const app = new Hono<HonoEnv>();
    app.onError(errorHandler);
    app.use(
      '*',
      createAuthMiddleware({
        findById: async (id: string) => users.find((row) => row.id === id)
      } as never)
    );
    app.get('/admin', requireActor(['admin']), (c) => c.json({ ok: true }));
    app.get('/eif', requireActor(['eif']), (c) => c.json({ ok: true }));
    return app;
  }

  test('uses database role instead of spoofed forwarded role', async () => {
    const response = await appFor([user]).request('/admin', {
      headers: {
        'x-eskwelabs-actor-id': user.id,
        'x-eskwelabs-actor-email': user.email,
        'x-eskwelabs-actor-role': 'admin',
        'x-eskwelabs-actor-active': 'true'
      }
    });

    expect(response.status).toBe(403);
  });

  test('rejects mismatched id/email headers', async () => {
    const response = await appFor([user]).request('/eif', {
      headers: {
        'x-eskwelabs-actor-id': user.id,
        'x-eskwelabs-actor-email': 'other@example.com',
        'x-eskwelabs-actor-role': 'eif',
        'x-eskwelabs-actor-active': 'true'
      }
    });

    expect(response.status).toBe(401);
  });

  test('rejects inactive database users', async () => {
    const response = await appFor([{ ...user, isActive: false }]).request(
      '/eif',
      {
        headers: {
          'x-eskwelabs-actor-id': user.id,
          'x-eskwelabs-actor-email': user.email,
          'x-eskwelabs-actor-role': 'eif',
          'x-eskwelabs-actor-active': 'true'
        }
      }
    );

    expect(response.status).toBe(401);
  });
});
