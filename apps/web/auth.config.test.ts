import { afterEach, describe, expect, test } from 'bun:test';

import { createAuthConfig } from './auth.config';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'eif@example.com',
  role: 'eif' as const,
  isActive: true
};

const adminActor = {
  ...actor,
  email: 'admin@example.com',
  role: 'admin' as const
};

function authConfigFor(
  resolveLogin: () => Promise<typeof actor | typeof adminActor | null>,
  telemetry: Array<{ eventName: string; payload: Record<string, unknown> }> = []
) {
  return createAuthConfig(
    {
      resolveLogin,
      resolveActor: async () => actor,
      resolveCredentials: async () => actor
    },
    {
      record: async (
        eventName: string,
        _actorId: string | undefined,
        _severity: string,
        payload: Record<string, unknown>
      ) => {
        telemetry.push({ eventName, payload });
      }
    }
  );
}

function signInInput(email?: string, provider = 'google') {
  return {
    user: {
      id: 'google-user',
      email
    },
    account: { provider },
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
    const telemetry: Array<{
      eventName: string;
      payload: Record<string, unknown>;
    }> = [];
    const config = authConfigFor(async () => actor, telemetry);

    await expect(
      config.callbacks?.signIn?.(signInInput(actor.email))
    ).resolves.toBe(true);
    expect(telemetry).toEqual([
      {
        eventName: 'login_success',
        payload: {
          email: actor.email,
          role: actor.role,
          provider: 'google'
        }
      }
    ]);
  });

  test('allows admin users through the admin provider', async () => {
    const config = authConfigFor(async () => adminActor);

    await expect(
      config.callbacks?.signIn?.(signInInput(adminActor.email, 'google-admin'))
    ).resolves.toBe(true);
  });

  test('rejects EIF users from the admin provider before session creation', async () => {
    const telemetry: Array<{
      eventName: string;
      payload: Record<string, unknown>;
    }> = [];
    const config = authConfigFor(async () => actor, telemetry);

    await expect(
      config.callbacks?.signIn?.(signInInput(actor.email, 'google-admin'))
    ).resolves.toBe('/admin/login');
    expect(telemetry).toEqual([
      {
        eventName: 'login_denied',
        payload: {
          email: actor.email,
          reason: 'role_mismatch',
          provider: 'google-admin',
          expectedRole: 'admin',
          actualRole: 'eif'
        }
      }
    ]);
  });

  test('rejects admin users from the EIF provider before session creation', async () => {
    const config = authConfigFor(async () => adminActor);

    await expect(
      config.callbacks?.signIn?.(signInInput(adminActor.email, 'google'))
    ).resolves.toBe('/admin/login');
  });

  test('redirects missing allow-list users to a stable login error', async () => {
    const telemetry: Array<{
      eventName: string;
      payload: Record<string, unknown>;
    }> = [];
    const config = authConfigFor(async () => null, telemetry);

    await expect(
      config.callbacks?.signIn?.(signInInput('missing@example.com'))
    ).resolves.toBe('/login');
    expect(telemetry).toEqual([
      {
        eventName: 'login_denied',
        payload: {
          email: 'missing@example.com',
          reason: 'not_in_allowlist',
          provider: 'google'
        }
      }
    ]);
  });

  test('redirects auth service failures to a safe login error', async () => {
    console.error = () => {};
    const config = authConfigFor(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:54322');
    });

    await expect(
      config.callbacks?.signIn?.(signInInput(actor.email))
    ).resolves.toBe('/login');
  });

  test('redirects admin auth service failures to the admin login', async () => {
    console.error = () => {};
    const config = authConfigFor(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:54322');
    });

    await expect(
      config.callbacks?.signIn?.(signInInput(adminActor.email, 'google-admin'))
    ).resolves.toBe('/admin/login');
  });
});
