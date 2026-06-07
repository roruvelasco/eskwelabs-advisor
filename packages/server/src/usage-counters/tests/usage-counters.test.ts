import { describe, expect, test } from 'bun:test';

import { UsageCountersRepository } from '../usage-counters.repository';
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

describe('usage counters repository', () => {
  test('increments with SQL deltas instead of read-then-overwrite', async () => {
    const calls: unknown[] = [];
    const repository = Object.create(
      UsageCountersRepository.prototype
    ) as UsageCountersRepository;
    const repositoryInternals = repository as unknown as {
      drizzle: unknown;
      findForUserDay: () => never;
    };

    repositoryInternals.findForUserDay = () => {
      throw new Error('findForUserDay should not be called');
    };
    repositoryInternals.drizzle = {
      db: {
        insert: () => ({
          values: (values: unknown) => {
            calls.push({ values });
            return {
              onConflictDoUpdate: (update: unknown) => {
                calls.push({ update });
                return {
                  returning: async () => [
                    {
                      userId: 'user-id',
                      dayPh: '2026-06-08',
                      messagesToday: 3,
                      tokensToday: 42,
                      estimatedSpendTodayUsd: '0.001000'
                    }
                  ]
                };
              }
            };
          }
        })
      }
    };

    await (repository as UsageCountersRepository).increment(
      'user-id',
      {
        messages: 1,
        tokens: 12,
        estimatedSpendUsd: 0.001
      },
      '2026-06-08'
    );

    expect(calls[0]).toEqual({
      values: {
        userId: 'user-id',
        dayPh: '2026-06-08',
        messagesToday: 1,
        tokensToday: 12,
        estimatedSpendTodayUsd: '0.001000'
      }
    });
    expect(calls[1]).toMatchObject({
      update: {
        target: expect.any(Array),
        set: {
          messagesToday: expect.any(Object),
          tokensToday: expect.any(Object),
          estimatedSpendTodayUsd: expect.any(Object)
        }
      }
    });
  });
});
