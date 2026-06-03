import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { ConversationsService } from '../conversations.service';

describe('conversations service', () => {
  test('lists placeholder conversations', async () => {
    const service = createContainer().get(ConversationsService);
    await expect(service.list()).resolves.toEqual([]);
  });
});
