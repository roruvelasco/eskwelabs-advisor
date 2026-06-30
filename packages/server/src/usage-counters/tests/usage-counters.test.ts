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

  test('summarizes daily usage with zero-filled missing days', async () => {
    const service = new UsageCountersService({
      dailyTotals: async () => [
        {
          dayPh: '2026-06-01',
          messages: 2,
          tokens: 100,
          estimatedSpendUsd: '0.010000'
        },
        {
          dayPh: '2026-06-03',
          messages: 1,
          tokens: 50,
          estimatedSpendUsd: '0.005000'
        }
      ],
      summaryTotals: async () => ({
        messages: 3,
        tokens: 150,
        estimatedSpendUsd: '0.015000',
        activeUsers: 1
      }),
      topUsers: async () => [
        {
          userId: 'user-1',
          userEmail: 'intern@example.com',
          messages: 3,
          tokens: 150,
          estimatedSpendUsd: '0.015000'
        }
      ]
    } as never);

    const summary = await service.summary({
      fromDayPh: '2026-06-01',
      toDayPh: '2026-06-03',
      topUsersLimit: 5
    });

    expect(summary).toEqual({
      range: {
        fromDayPh: '2026-06-01',
        toDayPh: '2026-06-03',
        timeZone: 'Asia/Manila'
      },
      totals: {
        messages: 3,
        tokens: 150,
        estimatedSpendUsd: '0.015000',
        activeUsers: 1
      },
      days: [
        {
          dayPh: '2026-06-01',
          messages: 2,
          tokens: 100,
          estimatedSpendUsd: '0.010000'
        },
        {
          dayPh: '2026-06-02',
          messages: 0,
          tokens: 0,
          estimatedSpendUsd: '0'
        },
        {
          dayPh: '2026-06-03',
          messages: 1,
          tokens: 50,
          estimatedSpendUsd: '0.005000'
        }
      ],
      topUsers: [
        {
          userId: 'user-1',
          userEmail: 'intern@example.com',
          messages: 3,
          tokens: 150,
          estimatedSpendUsd: '0.015000'
        }
      ]
    });
  });

  test('rejects summary ranges longer than 90 days', async () => {
    const service = new UsageCountersService({
      dailyTotals: async () => [],
      summaryTotals: async () => ({
        messages: 0,
        tokens: 0,
        estimatedSpendUsd: '0',
        activeUsers: 0
      }),
      topUsers: async () => []
    } as never);

    await expect(
      service.summary({
        fromDayPh: '2026-01-01',
        toDayPh: '2026-04-02'
      })
    ).rejects.toMatchObject({
      status: 400,
      code: 'validation_failed'
    });
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
