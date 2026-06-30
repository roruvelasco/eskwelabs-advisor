import { describe, expect, test } from 'bun:test';

import { UsageLimitsRepository } from '../usage-limits.repository';
import { UsageLimitsService } from '../usage-limits.service';

const baseLimits = {
  id: 'default',
  maxMessagesPerUserPerDay: 25,
  maxTokensPerUserPerDay: 100000,
  dailyBudgetUsd: '10',
  monthlyBudgetUsd: '300',
  rateLimitWindowSeconds: 60,
  rateLimitMaxRequests: 100,
  updatedBy: 'admin-old',
  updatedAt: new Date('2026-06-01T00:00:00.000Z')
};

describe('usage limits repository', () => {
  test('reserves global budget from raw snake_case SQL rows', async () => {
    const repository = Object.create(
      UsageLimitsRepository.prototype
    ) as UsageLimitsRepository;
    const responses: unknown[] = [
      undefined,
      undefined,
      [
        {
          period_kind: 'daily',
          period_key: '2026-06-24',
          estimated_spend_usd: '0.100000',
          updated_at: new Date(0)
        }
      ],
      [
        {
          period_kind: 'monthly',
          period_key: '2026-06',
          estimated_spend_usd: '0.200000',
          updated_at: new Date(0)
        }
      ],
      undefined,
      undefined
    ];
    const calls: unknown[] = [];

    (repository as unknown as { drizzle: unknown }).drizzle = {
      db: {
        transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            execute: async (query: unknown) => {
              calls.push(query);
              return responses.shift();
            }
          })
      }
    };

    await expect(
      repository.reserveGlobalBudget(0.001, {
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300'
      })
    ).resolves.toEqual({});

    expect(calls).toHaveLength(6);
  });

  test('records an audit event when limits are updated', async () => {
    const repository = Object.create(
      UsageLimitsRepository.prototype
    ) as UsageLimitsRepository;
    const calls: unknown[] = [];
    const nextLimits = {
      ...baseLimits,
      maxMessagesPerUserPerDay: 30,
      dailyBudgetUsd: '12',
      updatedBy: 'admin-new',
      updatedAt: new Date('2026-06-02T00:00:00.000Z')
    };

    (repository as unknown as { drizzle: unknown }).drizzle = {
      db: {
        transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            select: () => ({
              from: () => ({
                where: () => ({
                  limit: async () => [baseLimits]
                })
              })
            }),
            insert: () => ({
              values: (values: unknown) => {
                calls.push(values);
                if (calls.length === 1) {
                  return {
                    onConflictDoUpdate: () => ({
                      returning: async () => [nextLimits]
                    })
                  };
                }
                return undefined;
              }
            })
          })
      }
    };

    await expect(
      repository.update({
        maxMessagesPerUserPerDay: 30,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '12',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100,
        updatedBy: 'admin-new'
      })
    ).resolves.toEqual(nextLimits);

    expect(calls[1]).toMatchObject({
      changedBy: 'admin-new',
      previousConfig: {
        maxMessagesPerUserPerDay: 25,
        dailyBudgetUsd: '10'
      },
      nextConfig: {
        maxMessagesPerUserPerDay: 30,
        dailyBudgetUsd: '12'
      },
      createdAt: expect.any(Date)
    });
  });
});

describe('usage limits service', () => {
  test('builds review data with grouped enforcement counts', async () => {
    const service = new UsageLimitsService(
      {
        getOrThrow: async () => baseLimits,
        findGlobalBudget: async (periodKind: 'daily' | 'monthly') => ({
          periodKind,
          periodKey: periodKind === 'daily' ? '2026-06-30' : '2026-06',
          estimatedSpendUsd: periodKind === 'daily' ? '0.50' : '10.00',
          updatedAt: new Date()
        }),
        policyUsage: async () => ({
          peakMessagesPerUserPerDay: 4,
          peakTokensPerUserPerDay: 1200,
          totalMessages: 12,
          totalTokens: 3600,
          activeUsers: 3
        }),
        blockCountsSince: async () => [
          { reason: 'rate', count: 2 },
          { reason: 'cap', count: 1 },
          { reason: 'budget', count: 3 },
          { reason: 'unknown', count: 4 }
        ],
        listAuditEvents: async () => []
      } as never,
      {
        DAILY_MESSAGE_LIMIT: 25,
        DAILY_TOKEN_LIMIT: 100000,
        DAILY_SPEND_LIMIT_USD: 10,
        RATE_LIMIT_WINDOW_SECONDS: 60,
        RATE_LIMIT_MAX_REQUESTS: 100
      } as never
    );

    const review = await service.review();

    expect(review.config).toEqual(baseLimits);
    expect(review.status.daily).toMatchObject({
      spentUsd: '0.50',
      budgetUsd: '10',
      remainingUsd: '9.5'
    });
    expect(review.policy.metrics).toMatchObject({
      peakMessagesPerUserPerDay: 4,
      activeUsers: 3
    });
    expect(review.enforcement.counts).toEqual({
      rate: 2,
      cap: 1,
      budget: 3,
      other: 4,
      total: 10
    });
    expect(review.auditEvents).toEqual([]);
  });
});
