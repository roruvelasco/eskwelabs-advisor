import { describe, expect, test } from 'bun:test';

import { AuthService } from '../auth.service';
import type { User } from '../../users/users.schema';

describe('auth service', () => {
  const user: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'eif@example.com',
    role: 'eif',
    isActive: true,
    consentAcknowledgedAt: null,
    createdAt: new Date(0)
  };

  function serviceFor(users: User[]) {
    return new AuthService({
      findByEmail: async (email: string) =>
        users.find((row) => row.email === email.toLowerCase()),
      findById: async (id: string) => users.find((row) => row.id === id)
    } as never);
  }

  test('resolves active EIF login', async () => {
    await expect(serviceFor([user]).resolveLogin(user.email)).resolves.toEqual({
      id: user.id,
      email: user.email,
      role: 'eif',
      isActive: true
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
      isActive: true
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
});
