import type { ServerEnv } from '../config/env';
import type { UsageLimitsRepository } from './usage-limits.repository';
import type { UsageLimits } from './usage-limits.schema';

export type LimitsConfig = Pick<
  UsageLimits,
  | 'id'
  | 'maxMessagesPerUserPerDay'
  | 'maxTokensPerUserPerDay'
  | 'dailyBudgetUsd'
  | 'monthlyBudgetUsd'
  | 'rateLimitWindowSeconds'
  | 'rateLimitMaxRequests'
  | 'updatedBy'
  | 'updatedAt'
>;

export class UsageLimitsService {
  constructor(
    private usageLimitsRepository: UsageLimitsRepository,
    private env: ServerEnv
  ) {}

  async getConfig(): Promise<LimitsConfig> {
    try {
      return await this.usageLimitsRepository.getOrThrow();
    } catch {
      return {
        id: 'default',
        maxMessagesPerUserPerDay: this.env.DAILY_MESSAGE_LIMIT,
        maxTokensPerUserPerDay: this.env.DAILY_TOKEN_LIMIT,
        dailyBudgetUsd: String(this.env.DAILY_SPEND_LIMIT_USD),
        monthlyBudgetUsd: String(this.env.DAILY_SPEND_LIMIT_USD * 30),
        rateLimitWindowSeconds: this.env.RATE_LIMIT_WINDOW_SECONDS,
        rateLimitMaxRequests: this.env.RATE_LIMIT_MAX_REQUESTS,
        updatedBy: null,
        updatedAt: new Date(0)
      };
    }
  }

  async getEffectiveLimits(): Promise<LimitsConfig> {
    return this.getConfig();
  }

  async update(input: {
    maxMessagesPerUserPerDay: number;
    maxTokensPerUserPerDay: number;
    dailyBudgetUsd: string;
    monthlyBudgetUsd: string;
    rateLimitWindowSeconds: number;
    rateLimitMaxRequests: number;
    updatedBy: string;
  }): Promise<UsageLimits> {
    return this.usageLimitsRepository.update({
      ...input,
      dailyBudgetUsd: input.dailyBudgetUsd,
      monthlyBudgetUsd: input.monthlyBudgetUsd
    });
  }

  async reserveGlobalBudget(estimatedCostUsd: number) {
    const limits = await this.getConfig();
    return this.usageLimitsRepository.reserveGlobalBudget(
      estimatedCostUsd,
      limits
    );
  }

  async finalizeGlobalReservation(input: {
    estimatedCostUsd: number;
    actualCostUsd: number;
  }) {
    return this.usageLimitsRepository.finalizeGlobalReservation(input);
  }

  async releaseGlobalReservation(estimatedCostUsd: number) {
    return this.usageLimitsRepository.releaseGlobalReservation(
      estimatedCostUsd
    );
  }

  async getGlobalBudgetStatus() {
    const [daily, monthly] = await Promise.all([
      this.usageLimitsRepository.findGlobalBudget('daily'),
      this.usageLimitsRepository.findGlobalBudget('monthly')
    ]);

    const limits = await this.getConfig();

    return {
      daily: {
        periodKey: daily.periodKey,
        spentUsd: daily.estimatedSpendUsd,
        budgetUsd: limits.dailyBudgetUsd,
        remainingUsd: String(
          Math.max(
            0,
            Number(limits.dailyBudgetUsd) - Number(daily.estimatedSpendUsd)
          )
        )
      },
      monthly: {
        periodKey: monthly.periodKey,
        spentUsd: monthly.estimatedSpendUsd,
        budgetUsd: limits.monthlyBudgetUsd,
        remainingUsd: String(
          Math.max(
            0,
            Number(limits.monthlyBudgetUsd) - Number(monthly.estimatedSpendUsd)
          )
        )
      }
    };
  }
}
