import { UsageCountersRepository } from './usage-counters.repository';
import { getPhilippinesDay } from '../common/utils/day-ph';

export class UsageCountersService {
  constructor(
    private usageCountersRepository: UsageCountersRepository
  ) {}

  async list() {
    return this.usageCountersRepository.list();
  }

  async currentForUser(userId: string) {
    return this.usageCountersRepository.findForUserDay(userId, getPhilippinesDay());
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
}
