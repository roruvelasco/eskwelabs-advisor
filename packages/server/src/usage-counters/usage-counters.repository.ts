import { and, eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay } from '../common/utils/day-ph';
import { usageCountersTable, type UsageCounter } from './usage-counters.schema';

export type UsageCounterRow = UsageCounter;

export class UsageCountersRepository extends Repository {
  async list(): Promise<UsageCounter[]> {
    return this.drizzle.db.select().from(usageCountersTable);
  }

  async findForUserDay(userId: string, dayPh = getPhilippinesDay()) {
    const rows = await this.drizzle.db
      .select()
      .from(usageCountersTable)
      .where(
        and(
          eq(usageCountersTable.userId, userId),
          eq(usageCountersTable.dayPh, dayPh)
        )
      )
      .limit(1);

    return (
      rows[0] ?? {
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
    const values = {
      userId,
      dayPh,
      messagesToday: current.messagesToday + input.messages,
      tokensToday: current.tokensToday + input.tokens,
      estimatedSpendTodayUsd: (
        Number(current.estimatedSpendTodayUsd) + input.estimatedSpendUsd
      ).toFixed(6)
    };

    const rows = await this.drizzle.db
      .insert(usageCountersTable)
      .values(values)
      .onConflictDoUpdate({
        target: [usageCountersTable.userId, usageCountersTable.dayPh],
        set: values
      })
      .returning();

    return rows[0];
  }
}
