import { UsageCountersRepository } from './usage-counters.repository';
import type { PaginatedResult } from '../common/pagination';
import type {
  UsageCounterRow,
  UsageSummaryDay,
  UsageSummaryTopUser,
  UsageSummaryTotals
} from './usage-counters.repository';
import { getPhilippinesDay } from '../common/utils/day-ph';
import { validationFailed } from '../common/http/http-exception';

const MAX_SUMMARY_DAYS = 90;

function parseDay(dayPh: string) {
  const [year, month, day] = dayPh.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dayPh: string, days: number) {
  const date = parseDay(dayPh);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDay(date);
}

function daysBetweenInclusive(fromDayPh: string, toDayPh: string) {
  const from = parseDay(fromDayPh).getTime();
  const to = parseDay(toDayPh).getTime();
  return Math.floor((to - from) / 86_400_000) + 1;
}

function fillDailySeries(
  fromDayPh: string,
  toDayPh: string,
  rows: UsageSummaryDay[]
) {
  const byDay = new Map(rows.map((row) => [row.dayPh, row]));
  const result: UsageSummaryDay[] = [];
  let current = fromDayPh;

  while (current <= toDayPh) {
    result.push(
      byDay.get(current) ?? {
        dayPh: current,
        messages: 0,
        tokens: 0,
        estimatedSpendUsd: '0'
      }
    );
    current = addDays(current, 1);
  }

  return result;
}

export class UsageCountersService {
  constructor(private usageCountersRepository: UsageCountersRepository) {}

  async list({
    userId,
    dayPh,
    fromDayPh,
    toDayPh,
    limit,
    cursor
  }: {
    userId?: string;
    dayPh?: string;
    fromDayPh?: string;
    toDayPh?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginatedResult<UsageCounterRow>> {
    return this.usageCountersRepository.list({
      userId,
      dayPh,
      fromDayPh,
      toDayPh,
      limit,
      cursor
    });
  }

  async count() {
    return this.usageCountersRepository.count();
  }

  async summary({
    fromDayPh,
    toDayPh,
    userId,
    topUsersLimit = 5
  }: {
    fromDayPh?: string;
    toDayPh?: string;
    userId?: string;
    topUsersLimit?: number;
  } = {}): Promise<{
    range: { fromDayPh: string; toDayPh: string; timeZone: 'Asia/Manila' };
    totals: UsageSummaryTotals;
    days: UsageSummaryDay[];
    topUsers: UsageSummaryTopUser[];
  }> {
    const resolvedToDayPh = toDayPh ?? getPhilippinesDay();
    const resolvedFromDayPh = fromDayPh ?? addDays(resolvedToDayPh, -29);
    const dayCount = daysBetweenInclusive(resolvedFromDayPh, resolvedToDayPh);

    if (dayCount < 1 || dayCount > MAX_SUMMARY_DAYS) {
      throw validationFailed({
        fromDayPh: resolvedFromDayPh,
        toDayPh: resolvedToDayPh,
        maxDays: MAX_SUMMARY_DAYS
      });
    }

    const [dailyRows, totals, topUsers] = await Promise.all([
      this.usageCountersRepository.dailyTotals({
        fromDayPh: resolvedFromDayPh,
        toDayPh: resolvedToDayPh,
        userId
      }),
      this.usageCountersRepository.summaryTotals({
        fromDayPh: resolvedFromDayPh,
        toDayPh: resolvedToDayPh,
        userId
      }),
      this.usageCountersRepository.topUsers({
        fromDayPh: resolvedFromDayPh,
        toDayPh: resolvedToDayPh,
        limit: topUsersLimit,
        userId
      })
    ]);
    const days = fillDailySeries(resolvedFromDayPh, resolvedToDayPh, dailyRows);

    return {
      range: {
        fromDayPh: resolvedFromDayPh,
        toDayPh: resolvedToDayPh,
        timeZone: 'Asia/Manila'
      },
      totals,
      days,
      topUsers
    };
  }

  async currentForUser(userId: string) {
    return this.usageCountersRepository.findForUserDay(
      userId,
      getPhilippinesDay()
    );
  }

  async incrementTurn(
    userId: string,
    input: {
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: number;
    }
  ) {
    return this.usageCountersRepository.increment(userId, {
      messages: 1,
      tokens: input.promptTokens + input.completionTokens,
      estimatedSpendUsd: input.estimatedCostUsd
    });
  }

  async reserveTurn(
    userId: string,
    input: {
      estimatedTokens: number;
      estimatedCostUsd: number;
      maxMessages: number;
      maxTokens: number;
      maxSpendUsd: number;
    }
  ) {
    return this.usageCountersRepository.reserveWithinLimits(userId, {
      messages: 1,
      tokens: input.estimatedTokens,
      estimatedSpendUsd: input.estimatedCostUsd,
      maxMessages: input.maxMessages,
      maxTokens: input.maxTokens,
      maxSpendUsd: input.maxSpendUsd
    });
  }

  async finalizeReservation(
    userId: string,
    input: {
      estimatedTokens: number;
      actualTokens: number;
      estimatedCostUsd: number;
      actualCostUsd: number;
    }
  ) {
    return this.usageCountersRepository.adjust(userId, {
      messages: 0,
      tokens: input.actualTokens - input.estimatedTokens,
      estimatedSpendUsd: input.actualCostUsd - input.estimatedCostUsd
    });
  }

  async releaseReservation(
    userId: string,
    input: {
      estimatedTokens: number;
      estimatedCostUsd: number;
    }
  ) {
    return this.usageCountersRepository.adjust(userId, {
      messages: -1,
      tokens: -input.estimatedTokens,
      estimatedSpendUsd: -input.estimatedCostUsd
    });
  }
}
