import { describe, expect, test } from 'bun:test';

import type { ServerEnv } from '../../config/env';
import { CostCapEnforcer } from '../cost-cap.service';

const env = {
  DAILY_MESSAGE_LIMIT: 1,
  DAILY_TOKEN_LIMIT: 100,
  DAILY_SPEND_LIMIT_USD: 1
} as ServerEnv;

function enforcerFor(input: {
  messagesToday: number;
  tokensToday: number;
  estimatedSpendTodayUsd: string;
}) {
  return new CostCapEnforcer(
    {
      currentForUser: async () => ({
        userId: 'user-id',
        dayPh: '2026-06-03',
        ...input
      })
    } as never,
    {
      getEffectiveLimits: async () => ({
        id: 'default',
        maxMessagesPerUserPerDay: env.DAILY_MESSAGE_LIMIT,
        maxTokensPerUserPerDay: env.DAILY_TOKEN_LIMIT,
        dailyBudgetUsd: String(env.DAILY_SPEND_LIMIT_USD),
        monthlyBudgetUsd: String(env.DAILY_SPEND_LIMIT_USD * 30),
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100,
        updatedBy: null,
        updatedAt: new Date(0)
      })
    } as never,
    env
  );
}

describe('cost cap enforcer', () => {
  test('blocks when daily message cap is already reached', async () => {
    await expect(
      enforcerFor({
        messagesToday: 1,
        tokensToday: 0,
        estimatedSpendTodayUsd: '0'
      }).assertAllowed({
        userId: 'user-id',
        estimatedTokens: 1,
        estimatedCostUsd: 0
      })
    ).rejects.toMatchObject({ code: 'daily_message_limit' });
  });

  test('blocks when estimated turn exceeds remaining token cap', async () => {
    await expect(
      enforcerFor({
        messagesToday: 0,
        tokensToday: 99,
        estimatedSpendTodayUsd: '0'
      }).assertAllowed({
        userId: 'user-id',
        estimatedTokens: 2,
        estimatedCostUsd: 0
      })
    ).rejects.toMatchObject({ code: 'estimated_token_limit' });
  });

  test('allows a turn within caps', async () => {
    await expect(
      enforcerFor({
        messagesToday: 0,
        tokensToday: 10,
        estimatedSpendTodayUsd: '0.1'
      }).assertAllowed({
        userId: 'user-id',
        estimatedTokens: 10,
        estimatedCostUsd: 0.1
      })
    ).resolves.toBeUndefined();
  });

  test('blocks when estimated turn exceeds remaining spend cap', async () => {
    await expect(
      enforcerFor({
        messagesToday: 0,
        tokensToday: 10,
        estimatedSpendTodayUsd: '0.95'
      }).assertAllowed({
        userId: 'user-id',
        estimatedTokens: 10,
        estimatedCostUsd: 0.06
      })
    ).rejects.toMatchObject({ code: 'estimated_spend_limit' });
  });

  test('allows spend exactly at the decimal cap boundary', async () => {
    await expect(
      enforcerFor({
        messagesToday: 0,
        tokensToday: 10,
        estimatedSpendTodayUsd: '0.1'
      }).assertAllowed({
        userId: 'user-id',
        estimatedTokens: 10,
        estimatedCostUsd: 0.2
      })
    ).resolves.toBeUndefined();
  });
});
