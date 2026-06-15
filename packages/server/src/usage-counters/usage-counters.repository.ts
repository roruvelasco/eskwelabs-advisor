import { and, count, eq, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay } from '../common/utils/day-ph';
import { usageCountersTable, type UsageCounter } from './usage-counters.schema';

export type UsageCounterRow = UsageCounter;

type UsageLimitCheck = {
  messages: number;
  tokens: number;
  estimatedSpendUsd: number;
  maxMessages: number;
  maxTokens: number;
  maxSpendUsd: number;
};

type UsageAdjustment = {
  messages: number;
  tokens: number;
  estimatedSpendUsd: number;
};

type AdvisoryLockTransaction = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export class UsageCountersRepository extends Repository {
  private async lockUserDay(
    tx: AdvisoryLockTransaction,
    userId: string,
    dayPh: string
  ) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${userId}), hashtext(${dayPh}))`
    );
  }

  async list(): Promise<UsageCounter[]> {
    return this.drizzle.db.select().from(usageCountersTable);
  }

  async count(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(usageCountersTable);
    return rows[0]?.count ?? 0;
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
    const values = {
      userId,
      dayPh,
      messagesToday: input.messages,
      tokensToday: input.tokens,
      estimatedSpendTodayUsd: input.estimatedSpendUsd.toFixed(6)
    };

    const rows = await this.drizzle.db
      .insert(usageCountersTable)
      .values(values)
      .onConflictDoUpdate({
        target: [usageCountersTable.userId, usageCountersTable.dayPh],
        set: {
          messagesToday: sql`${usageCountersTable.messagesToday} + ${input.messages}`,
          tokensToday: sql`${usageCountersTable.tokensToday} + ${input.tokens}`,
          estimatedSpendTodayUsd: sql`${usageCountersTable.estimatedSpendTodayUsd} + ${input.estimatedSpendUsd}`
        }
      })
      .returning();

    return rows[0];
  }

  async reserveWithinLimits(
    userId: string,
    input: UsageLimitCheck,
    dayPh = getPhilippinesDay()
  ): Promise<{ row?: UsageCounter; blockedCode?: string }> {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockUserDay(tx, userId, dayPh);

      const rows = await tx
        .select()
        .from(usageCountersTable)
        .where(
          and(
            eq(usageCountersTable.userId, userId),
            eq(usageCountersTable.dayPh, dayPh)
          )
        )
        .limit(1);
      const current = rows[0] ?? {
        userId,
        dayPh,
        messagesToday: 0,
        tokensToday: 0,
        estimatedSpendTodayUsd: '0'
      };
      const spendToday = Number(current.estimatedSpendTodayUsd);

      if (current.messagesToday >= input.maxMessages) {
        return { blockedCode: 'daily_message_limit' };
      }

      if (current.tokensToday >= input.maxTokens) {
        return { blockedCode: 'daily_token_limit' };
      }

      if (spendToday >= input.maxSpendUsd) {
        return { blockedCode: 'daily_spend_limit' };
      }

      if (current.tokensToday + input.tokens > input.maxTokens) {
        return { blockedCode: 'estimated_token_limit' };
      }

      if (spendToday + input.estimatedSpendUsd > input.maxSpendUsd) {
        return { blockedCode: 'estimated_spend_limit' };
      }

      const reserved = await this.upsertAdjustmentTx(tx, userId, dayPh, {
        messages: input.messages,
        tokens: input.tokens,
        estimatedSpendUsd: input.estimatedSpendUsd
      });

      return { row: reserved };
    });
  }

  async adjust(
    userId: string,
    input: UsageAdjustment,
    dayPh = getPhilippinesDay()
  ) {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockUserDay(tx, userId, dayPh);
      return this.upsertAdjustmentTx(tx, userId, dayPh, input);
    });
  }

  private async upsertAdjustmentTx(
    tx: Parameters<Parameters<typeof this.drizzle.db.transaction>[0]>[0],
    userId: string,
    dayPh: string,
    input: UsageAdjustment
  ) {
    const rows = await tx
      .insert(usageCountersTable)
      .values({
        userId,
        dayPh,
        messagesToday: input.messages,
        tokensToday: input.tokens,
        estimatedSpendTodayUsd: input.estimatedSpendUsd.toFixed(6)
      })
      .onConflictDoUpdate({
        target: [usageCountersTable.userId, usageCountersTable.dayPh],
        set: {
          messagesToday: sql`greatest(${usageCountersTable.messagesToday} + ${input.messages}, 0)`,
          tokensToday: sql`greatest(${usageCountersTable.tokensToday} + ${input.tokens}, 0)`,
          estimatedSpendTodayUsd: sql`greatest(${usageCountersTable.estimatedSpendTodayUsd} + ${input.estimatedSpendUsd}, 0)`
        }
      })
      .returning();

    return rows[0];
  }
}
