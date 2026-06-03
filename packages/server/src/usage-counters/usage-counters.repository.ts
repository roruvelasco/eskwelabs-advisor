import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay } from '../common/utils/day-ph';

export interface UsageCounterRow {
  userId: string;
  dayPh: string;
  messagesToday: number;
  tokensToday: number;
  estimatedSpendTodayUsd: string;
}

const counters = new Map<string, UsageCounterRow>();

function key(userId: string, dayPh: string) {
  return `${userId}:${dayPh}`;
}

export class UsageCountersRepository extends Repository {
  async list() {
    return [...counters.values()];
  }

  async findForUserDay(userId: string, dayPh = getPhilippinesDay()) {
    return (
      counters.get(key(userId, dayPh)) ?? {
        userId,
        dayPh,
        messagesToday: 0,
        tokensToday: 0,
        estimatedSpendTodayUsd: '0'
      }
    );
  }

  async increment(
    userId: string,
    input: { messages: number; tokens: number; estimatedSpendUsd: number },
    dayPh = getPhilippinesDay()
  ) {
    const current = await this.findForUserDay(userId, dayPh);
    const row = {
      ...current,
      messagesToday: current.messagesToday + input.messages,
      tokensToday: current.tokensToday + input.tokens,
      estimatedSpendTodayUsd: (
        Number(current.estimatedSpendTodayUsd) + input.estimatedSpendUsd
      ).toFixed(6)
    };
    counters.set(key(userId, dayPh), row);
    return row;
  }
}
