import { describe, expect, test } from 'bun:test';

import { UsersService } from '../users.service';
import type { User } from '../users.schema';
import type { PaginatedResult } from '../users.repository';
import { createUserDto } from '../dto/create-user.dto';

describe('users service', () => {
  const user: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'eif@example.com',
    passwordHash: null,
    role: 'eif',
    isActive: true,
    consentAcknowledgedAt: null,
    createdAt: new Date(0)
  };

  function serviceFor(repository: {
    list?: () => Promise<PaginatedResult<User>>;
    findByEmail?: (email: string) => Promise<User | undefined>;
    findById?: (id: string) => Promise<User | undefined>;
    createOrReactivate?: (
      email: string,
      role: 'eif' | 'admin'
    ) => Promise<User>;
    update?: (
      id: string,
      data: Partial<Pick<User, 'role' | 'isActive'>>
    ) => Promise<User | undefined>;
    acknowledgeConsent?: (userId: string) => Promise<User | undefined>;
  }) {
    return new UsersService(repository as never);
  }

  test('lists users from repository', async () => {
    const service = serviceFor({
      list: async () => ({ rows: [user], nextCursor: null })
    });
    await expect(service.list()).resolves.toEqual({
      rows: [user],
      nextCursor: null
    });
  });

  test('normalizes create user email input', () => {
    expect(
      createUserDto.parse({ email: 'EIF@Example.COM', role: 'eif' })
    ).toEqual({
      email: 'eif@example.com',
      role: 'eif'
    });
  });

  test('acknowledges consent for a user', async () => {
    const acknowledgedAt = new Date();
    const service = serviceFor({
      acknowledgeConsent: async (userId) => ({
        ...user,
        id: userId,
        consentAcknowledgedAt: acknowledgedAt
      })
    });

    await expect(service.acknowledgeConsent(user.id)).resolves.toMatchObject({
      id: user.id,
      consentAcknowledgedAt: acknowledgedAt
    });
  });

  test('rejects self deactivation', async () => {
    const service = serviceFor({
      update: async () => user
    });

    await expect(
      service.update(user, user.id, { isActive: false })
    ).rejects.toMatchObject({
      status: 403,
      code: 'forbidden'
    });
  });

  test('rejects self demotion', async () => {
    const admin = { ...user, role: 'admin' as const };
    const service = serviceFor({
      update: async () => admin
    });

    await expect(
      service.update(admin, admin.id, { role: 'eif' })
    ).rejects.toMatchObject({
      status: 403,
      code: 'forbidden'
    });
  });

  test('allows admin to deactivate another user', async () => {
    const admin = {
      ...user,
      id: '22222222-2222-4222-8222-222222222222',
      email: 'admin@example.com',
      role: 'admin' as const
    };
    const service = serviceFor({
      update: async (id, data) => ({ ...user, id, ...data })
    });

    await expect(
      service.update(admin, user.id, { isActive: false })
    ).resolves.toMatchObject({
      id: user.id,
      isActive: false
    });
  });
});
