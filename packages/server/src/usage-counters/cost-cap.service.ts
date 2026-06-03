import { HttpException } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';

import type { UsageCountersService } from './usage-counters.service';

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
    const spendToday = Number(usage.estimatedSpendTodayUsd);

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

    if (spendToday >= this.env.DAILY_SPEND_LIMIT_USD) {
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

    if (spendToday + input.estimatedCostUsd > this.env.DAILY_SPEND_LIMIT_USD) {
      throw new HttpException(
        429,
        'Estimated turn would exceed daily spend limit',
        'estimated_spend_limit'
      );
    }
  }
}
