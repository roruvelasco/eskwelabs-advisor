import { describe, expect, test } from 'bun:test';
import { hash } from 'bcryptjs';

import { AuthService } from '../auth.service';
import type { User } from '../../users/users.schema';

describe('auth service', () => {
  const user: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'eif@example.com',
    passwordHash: null,
    role: 'eif',
    isActive: true,
    consentAcknowledgedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };

  function serviceFor(users: User[]) {
    return new AuthService({
      findByEmail: async (email: string) =>
        users.find((row) => row.email === email.toLowerCase()),
      findById: async (id: string) => users.find((row) => row.id === id)
    } as never);
  }

  function serviceForWithCredentialLimit(
    users: User[],
    maxAttempts: number,
    lockoutSeconds = 900
  ) {
    return new AuthService(
      {
        findByEmail: async (email: string) =>
          users.find((row) => row.email === email.toLowerCase()),
        findById: async (id: string) => users.find((row) => row.id === id)
      } as never,
      undefined,
      {
        CREDENTIAL_LOGIN_LOCKOUT_SECONDS: lockoutSeconds,
        CREDENTIAL_LOGIN_MAX_ATTEMPTS: maxAttempts
      }
    );
  }

  test('resolves active EIF login', async () => {
    await expect(serviceFor([user]).resolveLogin(user.email)).resolves.toEqual({
      id: user.id,
      email: user.email,
      role: 'eif',
      isActive: true,
      consentAcknowledgedAt: null
    });
  });

  test('resolves active admin login', async () => {
    const admin = { ...user, role: 'admin' as const };

    await expect(
      serviceFor([admin]).resolveLogin(admin.email)
    ).resolves.toEqual({
      id: admin.id,
      email: admin.email,
      role: 'admin',
      isActive: true,
      consentAcknowledgedAt: null
    });
  });

  test('rejects inactive login', async () => {
    await expect(
      serviceFor([{ ...user, isActive: false }]).resolveLogin(user.email)
    ).resolves.toBeNull();
  });

  test('rejects missing login', async () => {
    await expect(serviceFor([]).resolveLogin(user.email)).resolves.toBeNull();
  });

  test('rejects actor id/email mismatch', async () => {
    await expect(
      serviceFor([user]).resolveActor(user.id, 'other@example.com')
    ).resolves.toBeNull();
  });

  describe('resolveCredentials', () => {
    const passwordPlain = 'password123';
    let passwordHash: string;

    test('resolves credentials for active user with password', async () => {
      passwordHash = await hash(passwordPlain, 10);
      const pwUser = { ...user, passwordHash };
      await expect(
        serviceFor([pwUser]).resolveCredentials(user.email, passwordPlain)
      ).resolves.toEqual({
        id: user.id,
        email: user.email,
        role: 'eif',
        isActive: true,
        consentAcknowledgedAt: null
      });
    });

    test('rejects credentials with wrong password', async () => {
      const pwUser = { ...user, passwordHash };
      await expect(
        serviceFor([pwUser]).resolveCredentials(user.email, 'wrong-password')
      ).resolves.toBeNull();
    });

    test('rejects credentials for inactive user', async () => {
      const pwUser = { ...user, passwordHash, isActive: false };
      await expect(
        serviceFor([pwUser]).resolveCredentials(user.email, passwordPlain)
      ).resolves.toBeNull();
    });

    test('rejects credentials for user without passwordHash', async () => {
      await expect(
        serviceFor([user]).resolveCredentials(user.email, passwordPlain)
      ).resolves.toBeNull();
    });

    test('rejects credentials for non-existent user', async () => {
      await expect(
        serviceFor([user]).resolveCredentials(
          'unknown@example.com',
          passwordPlain
        )
      ).resolves.toBeNull();
    });

    test('blocks credential attempts after the configured threshold', async () => {
      passwordHash = await hash(passwordPlain, 10);
      const pwUser = { ...user, passwordHash };
      const service = serviceForWithCredentialLimit([pwUser], 2);

      await expect(
        service.resolveCredentials(user.email, 'wrong-password-1')
      ).resolves.toBeNull();
      await expect(
        service.resolveCredentials(user.email, 'wrong-password-2')
      ).resolves.toBeNull();
      await expect(
        service.resolveCredentials(user.email, 'wrong-password-3')
      ).rejects.toMatchObject({
        code: 'rate_limited',
        status: 429,
        safeDetails: expect.objectContaining({
          limit: 2,
          remaining: 0,
          resetSeconds: 900
        })
      });
    });

    test('clears failed credential attempts after a successful login', async () => {
      passwordHash = await hash(passwordPlain, 10);
      const pwUser = { ...user, passwordHash };
      const service = serviceForWithCredentialLimit([pwUser], 2);

      await expect(
        service.resolveCredentials(user.email, 'wrong-password')
      ).resolves.toBeNull();
      await expect(
        service.resolveCredentials(user.email.toUpperCase(), passwordPlain)
      ).resolves.toEqual({
        id: user.id,
        email: user.email,
        role: 'eif',
        isActive: true,
        consentAcknowledgedAt: null
      });
      await expect(
        service.resolveCredentials(user.email, 'wrong-password')
      ).resolves.toBeNull();
    });

    test('uses hashed Redis keys for credential attempt counters', async () => {
      passwordHash = await hash(passwordPlain, 10);
      const keys: string[] = [];
      const service = new AuthService(
        {
          findByEmail: async () => ({ ...user, passwordHash }),
          findById: async (id: string) => (id === user.id ? user : undefined)
        } as never,
        {
          incrWithTtl: async (key: string) => {
            keys.push(key);
            return 1;
          },
          del: async () => undefined
        },
        {
          CREDENTIAL_LOGIN_LOCKOUT_SECONDS: 900,
          CREDENTIAL_LOGIN_MAX_ATTEMPTS: 2
        }
      );

      await expect(
        service.resolveCredentials(user.email, 'wrong-password')
      ).resolves.toBeNull();

      expect(keys).toHaveLength(1);
      expect(keys[0]).toStartWith('auth:credentials:');
      expect(keys[0]).not.toContain(user.email);
    });
  });
});
