import { HttpException } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';

import type { UsageCountersService } from './usage-counters.service';
import { usdGreaterThan, usdToMicros } from './money';

export type CostReservation = {
  userId: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
};

export class CostCapEnforcer {
  constructor(
    private usageCountersService: UsageCountersService,
    private env: ServerEnv
  ) {}

  async assertAllowed(input: {
    userId: string;
    estimatedTokens: number;
    estimatedCostUsd: number;
  }) {
    const usage = await this.usageCountersService.currentForUser(input.userId);
    const spendTodayMicros = usdToMicros(usage.estimatedSpendTodayUsd);

    if (usage.messagesToday >= this.env.DAILY_MESSAGE_LIMIT) {
      throw new HttpException(
        429,
        'Daily message limit reached',
        'daily_message_limit'
      );
    }

    if (usage.tokensToday >= this.env.DAILY_TOKEN_LIMIT) {
      throw new HttpException(
        429,
        'Daily token limit reached',
        'daily_token_limit'
      );
    }

    if (!usdGreaterThan(this.env.DAILY_SPEND_LIMIT_USD, spendTodayMicros)) {
      throw new HttpException(
        429,
        'Daily spend limit reached',
        'daily_spend_limit'
      );
    }

    if (
      usage.tokensToday + input.estimatedTokens >
      this.env.DAILY_TOKEN_LIMIT
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
        this.env.DAILY_SPEND_LIMIT_USD
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
    const result = await this.usageCountersService.reserveTurn(input.userId, {
      estimatedTokens: input.estimatedTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      maxMessages: this.env.DAILY_MESSAGE_LIMIT,
      maxTokens: this.env.DAILY_TOKEN_LIMIT,
      maxSpendUsd: this.env.DAILY_SPEND_LIMIT_USD
    });

    if (result.blockedCode) {
      throw this.blocked(result.blockedCode);
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
  }

  async releaseReservation(reservation?: CostReservation) {
    if (!reservation) return;
    await this.usageCountersService.releaseReservation(reservation.userId, {
      estimatedTokens: reservation.estimatedTokens,
      estimatedCostUsd: reservation.estimatedCostUsd
    });
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

    return new HttpException(429, 'Usage limit reached', code);
  }
}
