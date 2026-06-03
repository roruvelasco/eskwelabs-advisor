import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { UsageCountersService } from '../usage-counters.service';

describe('usage counters service', () => {
  test('lists PH-day aggregate usage row', async () => {
    const service = createContainer().get(UsageCountersService);
    const row = await service.currentForUser('aggregate');
    expect(row).toMatchObject({
      userId: 'aggregate',
      messagesToday: 0,
      tokensToday: 0
    });
  });
});
