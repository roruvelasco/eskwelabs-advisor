import { afterEach, describe, expect, test } from 'bun:test';

import { createAuthConfig } from './auth.config';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'eif@example.com',
  role: 'eif' as const,
  isActive: true
};

function authConfigFor(resolveLogin: () => Promise<typeof actor | null>) {
  return createAuthConfig({
    resolveLogin,
    resolveActor: async () => actor
  });
}

function signInInput(email?: string) {
  return {
    user: {
      id: 'google-user',
      email
    },
    account: null,
    profile: undefined,
    email: undefined,
    credentials: undefined
  } as never;
}

describe('auth config', () => {
  const originalError = console.error;

  afterEach(() => {
    console.error = originalError;
  });

  test('allows allow-listed users to sign in', async () => {
    const config = authConfigFor(async () => actor);

    await expect(
      config.callbacks?.signIn?.(signInInput(actor.email))
    ).resolves.toBe(true);
  });

  test('redirects missing allow-list users to a stable login error', async () => {
    const config = authConfigFor(async () => null);

    await expect(
      config.callbacks?.signIn?.(signInInput('missing@example.com'))
    ).resolves.toBe('/login?error=NotAllowlisted');
  });

  test('redirects auth service failures to a safe login error', async () => {
    console.error = () => {};
    const config = authConfigFor(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:54322');
    });

    await expect(
      config.callbacks?.signIn?.(signInInput(actor.email))
    ).resolves.toBe('/login?error=AuthServiceUnavailable');
  });
});
