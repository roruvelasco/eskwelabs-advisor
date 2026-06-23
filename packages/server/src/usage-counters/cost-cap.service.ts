import { HttpException } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';

import type { UsageCountersService } from './usage-counters.service';
import type { UsageLimitsService } from '../usage-limits/usage-limits.service';
import { usdGreaterThan, usdToMicros } from './money';

export type CostReservation = {
  userId: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
};

export class CostCapEnforcer {
  constructor(
    private usageCountersService: UsageCountersService,
    private usageLimitsService: UsageLimitsService,
    private env: ServerEnv
  ) {}

  async assertAllowed(input: {
    userId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }) {
    const [usage, limits] = await Promise.all([
      this.usageCountersService.currentForUser(input.userId),
      this.usageLimitsService.getEffectiveLimits()
    ]);

    const spendTodayMicros = usdToMicros(usage.estimatedSpendTodayUsd);

    if (usage.messagesToday >= limits.maxMessagesPerUserPerDay) {
      throw new HttpException(
        429,
        'Daily message limit reached',
        'daily_message_limit'
      );
    }

    if (usage.tokensToday >= limits.maxTokensPerUserPerDay) {
      throw new HttpException(
        429,
        'Daily token limit reached',
        'daily_token_limit'
      );
    }

    if (!usdGreaterThan(limits.dailyBudgetUsd, spendTodayMicros)) {
      throw new HttpException(
        429,
        'Daily spend limit reached',
        'daily_spend_limit'
      );
    }

    if (
      usage.tokensToday + input.estimatedTokens >
      limits.maxTokensPerUserPerDay
    ) {
      throw new HttpException(
        429,
        'Estimated turn would exceed daily token limit',
        'estimated_token_limit'
      );
    }

    if (
      usdGreaterThan(
        spendTodayMicros + usdToMicros(input.estimatedCostUsd),
        limits.dailyBudgetUsd
      )
    ) {
      throw new HttpException(
        429,
        'Estimated turn would exceed daily spend limit',
        'estimated_spend_limit'
      );
    }
  }

  async reserveTurn(input: {
    userId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }): Promise<CostReservation> {
    const limits = await this.usageLimitsService.getEffectiveLimits();

    const result = await this.usageCountersService.reserveTurn(input.userId, {
      estimatedTokens: input.estimatedTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      maxMessages: limits.maxMessagesPerUserPerDay,
      maxTokens: limits.maxTokensPerUserPerDay,
      maxSpendUsd: Number(limits.dailyBudgetUsd)
    });

    if (result.blockedCode) {
      throw this.blocked(result.blockedCode);
    }

    const globalResult = await this.usageLimitsService.reserveGlobalBudget(
      input.estimatedCostUsd
    );

    if (globalResult.blockedCode) {
      await this.usageCountersService.releaseReservation(input.userId, {
        estimatedTokens: input.estimatedTokens,
        estimatedCostUsd: input.estimatedCostUsd
      });
      throw this.blocked(globalResult.blockedCode);
    }

    return input;
  }

  async finalizeReservation(
    reservation: CostReservation,
    input: {
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: number;
    }
  ) {
    await this.usageCountersService.finalizeReservation(reservation.userId, {
      estimatedTokens: reservation.estimatedTokens,
      actualTokens: input.promptTokens + input.completionTokens,
      estimatedCostUsd: reservation.estimatedCostUsd,
      actualCostUsd: input.estimatedCostUsd
    });
    await this.usageLimitsService.finalizeGlobalReservation({
      estimatedCostUsd: reservation.estimatedCostUsd,
      actualCostUsd: input.estimatedCostUsd
    });
  }

  async releaseReservation(reservation?: CostReservation) {
    if (!reservation) return;
    try {
      await this.usageCountersService.releaseReservation(reservation.userId, {
        estimatedTokens: reservation.estimatedTokens,
        estimatedCostUsd: reservation.estimatedCostUsd
      });
    } catch {
      // per-user release is best-effort
    }
    try {
      await this.usageLimitsService.releaseGlobalReservation(
        reservation.estimatedCostUsd
      );
    } catch {
      // global release is best-effort
    }
  }

  private blocked(code: string) {
    if (code === 'daily_message_limit') {
      return new HttpException(429, 'Daily message limit reached', code);
    }

    if (code === 'daily_token_limit') {
      return new HttpException(429, 'Daily token limit reached', code);
    }

    if (code === 'daily_spend_limit') {
      return new HttpException(429, 'Daily spend limit reached', code);
    }

    if (code === 'estimated_token_limit') {
      return new HttpException(
        429,
        'Estimated turn would exceed daily token limit',
        code
      );
    }

    if (code === 'estimated_spend_limit') {
      return new HttpException(
        429,
        'Estimated turn would exceed daily spend limit',
        code
      );
    }

    if (code === 'daily_budget_limit') {
      return new HttpException(429, 'Daily platform budget reached', code);
    }

    if (code === 'monthly_budget_limit') {
      return new HttpException(429, 'Monthly platform budget reached', code);
    }

    return new HttpException(429, 'Usage limit reached', code);
  }
}
