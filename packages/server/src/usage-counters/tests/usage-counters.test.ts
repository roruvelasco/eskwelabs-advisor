import { describe, expect, test } from 'bun:test';

import { UsageCountersService } from '../usage-counters.service';

describe('usage counters service', () => {
  test('reads current PH-day usage for a user', async () => {
    const userId = crypto.randomUUID();
    const service = new UsageCountersService({
      findForUserDay: async (requestedUserId: string, dayPh: string) => ({
        userId: requestedUserId,
        dayPh,
        messagesToday: 0,
        tokensToday: 0,
        estimatedSpendTodayUsd: '0'
      })
    } as never);

    const row = await service.currentForUser(userId);

    expect(row).toMatchObject({
      userId,
      messagesToday: 0,
      tokensToday: 0
    });
  });

  test('increments one completed turn with combined token usage', async () => {
    const userId = crypto.randomUUID();
    const calls: unknown[] = [];
    const service = new UsageCountersService({
      increment: async (requestedUserId: string, input: unknown) => {
        calls.push({ requestedUserId, input });
        return {
          userId: requestedUserId,
          dayPh: '2026-06-07',
          messagesToday: 1,
          tokensToday: 42,
          estimatedSpendTodayUsd: '0.001000'
        };
      }
    } as never);

    await service.incrementTurn(userId, {
      promptTokens: 30,
      completionTokens: 12,
      estimatedCostUsd: 0.001
    });

    expect(calls).toEqual([
      {
        requestedUserId: userId,
        input: {
          messages: 1,
          tokens: 42,
          estimatedSpendUsd: 0.001
        }
      }
    ]);
  });
});
