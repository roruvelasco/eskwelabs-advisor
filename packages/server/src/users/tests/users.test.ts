import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { UsersService } from '../users.service';

describe('users service', () => {
  test('lists placeholder users', async () => {
    const service = createContainer().get(UsersService);
    await expect(service.list()).resolves.toEqual([]);
  });
});
