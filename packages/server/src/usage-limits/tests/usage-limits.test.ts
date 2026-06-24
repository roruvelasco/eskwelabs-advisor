import { describe, expect, test } from 'bun:test';

import { UsageLimitsRepository } from '../usage-limits.repository';

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
});
