import type { ServerEnv } from '../config/env';
import type {
  UsageLimitAuditEventRow,
  UsageLimitBlockCount,
  UsageLimitsPolicyUsage,
  UsageLimitsRepository
} from './usage-limits.repository';
import { getPhilippinesDay } from '../common/utils/day-ph';
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

export type UsageBudgetStatus = {
  daily: {
    periodKey: string;
    spentUsd: string;
    budgetUsd: string;
    remainingUsd: string;
  };
  monthly: {
    periodKey: string;
    spentUsd: string;
    budgetUsd: string;
    remainingUsd: string;
  };
};

export type UsageLimitsReview = {
  config: LimitsConfig;
  status: UsageBudgetStatus;
  policy: {
    range: {
      fromDayPh: string;
      toDayPh: string;
      timeZone: 'Asia/Manila';
    };
    metrics: UsageLimitsPolicyUsage;
  };
  enforcement: {
    since: string;
    counts: {
      rate: number;
      cap: number;
      budget: number;
      other: number;
      total: number;
    };
  };
  auditEvents: UsageLimitAuditEventRow[];
};

function parseDay(dayPh: string) {
  const [year, month, day] = dayPh.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dayPh: string, days: number) {
  const date = parseDay(dayPh);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function groupedBlockCounts(rows: UsageLimitBlockCount[]) {
  const counts = { rate: 0, cap: 0, budget: 0, other: 0, total: 0 };

  for (const row of rows) {
    if (row.reason === 'rate') counts.rate += row.count;
    else if (row.reason === 'cap') counts.cap += row.count;
    else if (row.reason === 'budget') counts.budget += row.count;
    else counts.other += row.count;
    counts.total += row.count;
  }

  return counts;
}

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

  async getGlobalBudgetStatus(): Promise<UsageBudgetStatus> {
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

  async review(): Promise<UsageLimitsReview> {
    const toDayPh = getPhilippinesDay();
    const fromDayPh = addDays(toDayPh, -6);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [config, status, policyUsage, blockCounts, auditEvents] =
      await Promise.all([
        this.getConfig(),
        this.getGlobalBudgetStatus(),
        this.usageLimitsRepository.policyUsage({ fromDayPh, toDayPh }),
        this.usageLimitsRepository.blockCountsSince(since),
        this.usageLimitsRepository.listAuditEvents(10)
      ]);

    return {
      config,
      status,
      policy: {
        range: {
          fromDayPh,
          toDayPh,
          timeZone: 'Asia/Manila'
        },
        metrics: policyUsage
      },
      enforcement: {
        since: since.toISOString(),
        counts: groupedBlockCounts(blockCounts)
      },
      auditEvents
    };
  }
}
