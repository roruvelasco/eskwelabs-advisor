import { UsageCountersRepository } from './usage-counters.repository';
import type { PaginatedResult } from './usage-counters.repository';
import type { UsageCounterRow } from './usage-counters.repository';
import { getPhilippinesDay } from '../common/utils/day-ph';

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
