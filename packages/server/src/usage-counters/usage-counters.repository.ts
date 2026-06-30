import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  lte,
  lt,
  or,
  sql
} from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, paginateResult } from '../common/pagination';
import type { PaginatedResult } from '../common/pagination';
import { getPhilippinesDay } from '../common/utils/day-ph';
import { usageCountersTable, type UsageCounter } from './usage-counters.schema';
import { usdAmount, usdGreaterThan, usdToMicros } from './money';
import { usersTable } from '../users/users.schema';

export type UsageCounterRow = Pick<
  UsageCounter,
  | 'userId'
  | 'dayPh'
  | 'messagesToday'
  | 'tokensToday'
  | 'estimatedSpendTodayUsd'
> & { userEmail?: string | null };

export type UsageSummaryDay = {
  dayPh: string;
  messages: number;
  tokens: number;
  estimatedSpendUsd: string;
};

export type UsageSummaryTopUser = {
  userId: string;
  userEmail?: string | null;
  messages: number;
  tokens: number;
  estimatedSpendUsd: string;
};

export type UsageSummaryTotals = {
  messages: number;
  tokens: number;
  estimatedSpendUsd: string;
  activeUsers: number;
};

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

  async list({
    userId,
    dayPh,
    fromDayPh,
    toDayPh,
    limit = 50,
    cursor
  }: {
    userId?: string;
    dayPh?: string;
    fromDayPh?: string;
    toDayPh?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginatedResult<UsageCounterRow>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(usageCountersTable.dayPh, decoded.dayPh as string),
          and(
            eq(usageCountersTable.dayPh, decoded.dayPh as string),
            gt(usageCountersTable.userId, decoded.userId as string)
          )
        )
      : undefined;

    const whereConditions = [
      ...(userId ? [eq(usageCountersTable.userId, userId)] : []),
      ...(dayPh ? [eq(usageCountersTable.dayPh, dayPh)] : []),
      ...(fromDayPh ? [gte(usageCountersTable.dayPh, fromDayPh)] : []),
      ...(toDayPh ? [lte(usageCountersTable.dayPh, toDayPh)] : []),
      ...(cursorConditions ? [cursorConditions] : [])
    ];

    const rows = await this.drizzle.db
      .select({
        userId: usageCountersTable.userId,
        dayPh: usageCountersTable.dayPh,
        messagesToday: usageCountersTable.messagesToday,
        tokensToday: usageCountersTable.tokensToday,
        estimatedSpendTodayUsd: usageCountersTable.estimatedSpendTodayUsd,
        userEmail: usersTable.email
      })
      .from(usageCountersTable)
      .leftJoin(usersTable, eq(usersTable.id, usageCountersTable.userId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(usageCountersTable.dayPh), asc(usageCountersTable.userId))
      .limit(limit + 1);

    return paginateResult(rows, limit, (last) => ({
      dayPh: last.dayPh,
      userId: last.userId
    }));
  }

  async count(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(usageCountersTable);
    return rows[0]?.count ?? 0;
  }

  async dailyTotals({
    fromDayPh,
    toDayPh,
    userId
  }: {
    fromDayPh: string;
    toDayPh: string;
    userId?: string;
  }): Promise<UsageSummaryDay[]> {
    const whereConditions = [
      gte(usageCountersTable.dayPh, fromDayPh),
      lte(usageCountersTable.dayPh, toDayPh),
      ...(userId ? [eq(usageCountersTable.userId, userId)] : [])
    ];

    const rows = await this.drizzle.db
      .select({
        dayPh: usageCountersTable.dayPh,
        messages: sql<number>`coalesce(sum(${usageCountersTable.messagesToday}), 0)`,
        tokens: sql<number>`coalesce(sum(${usageCountersTable.tokensToday}), 0)`,
        estimatedSpendUsd: sql<string>`coalesce(sum(${usageCountersTable.estimatedSpendTodayUsd}), 0)::text`
      })
      .from(usageCountersTable)
      .where(and(...whereConditions))
      .groupBy(usageCountersTable.dayPh)
      .orderBy(asc(usageCountersTable.dayPh));

    return rows.map((row) => ({
      dayPh: row.dayPh,
      messages: Number(row.messages),
      tokens: Number(row.tokens),
      estimatedSpendUsd: row.estimatedSpendUsd
    }));
  }

  async topUsers({
    fromDayPh,
    toDayPh,
    limit,
    userId
  }: {
    fromDayPh: string;
    toDayPh: string;
    limit: number;
    userId?: string;
  }): Promise<UsageSummaryTopUser[]> {
    const spend = sql<string>`coalesce(sum(${usageCountersTable.estimatedSpendTodayUsd}), 0)::text`;
    const tokens = sql<number>`coalesce(sum(${usageCountersTable.tokensToday}), 0)`;
    const messages = sql<number>`coalesce(sum(${usageCountersTable.messagesToday}), 0)`;
    const whereConditions = [
      gte(usageCountersTable.dayPh, fromDayPh),
      lte(usageCountersTable.dayPh, toDayPh),
      ...(userId ? [eq(usageCountersTable.userId, userId)] : [])
    ];

    const rows = await this.drizzle.db
      .select({
        userId: usageCountersTable.userId,
        userEmail: usersTable.email,
        messages,
        tokens,
        estimatedSpendUsd: spend
      })
      .from(usageCountersTable)
      .leftJoin(usersTable, eq(usersTable.id, usageCountersTable.userId))
      .where(and(...whereConditions))
      .groupBy(usageCountersTable.userId, usersTable.email)
      .orderBy(
        desc(sql`sum(${usageCountersTable.estimatedSpendTodayUsd})`),
        desc(tokens),
        desc(messages)
      )
      .limit(limit);

    return rows.map((row) => ({
      userId: row.userId,
      userEmail: row.userEmail,
      messages: Number(row.messages),
      tokens: Number(row.tokens),
      estimatedSpendUsd: row.estimatedSpendUsd
    }));
  }

  async summaryTotals({
    fromDayPh,
    toDayPh,
    userId
  }: {
    fromDayPh: string;
    toDayPh: string;
    userId?: string;
  }): Promise<UsageSummaryTotals> {
    const whereConditions = [
      gte(usageCountersTable.dayPh, fromDayPh),
      lte(usageCountersTable.dayPh, toDayPh),
      ...(userId ? [eq(usageCountersTable.userId, userId)] : [])
    ];

    const rows = await this.drizzle.db
      .select({
        messages: sql<number>`coalesce(sum(${usageCountersTable.messagesToday}), 0)`,
        tokens: sql<number>`coalesce(sum(${usageCountersTable.tokensToday}), 0)`,
        estimatedSpendUsd: sql<string>`coalesce(sum(${usageCountersTable.estimatedSpendTodayUsd}), 0)::text`,
        activeUsers: sql<number>`count(distinct ${usageCountersTable.userId})`
      })
      .from(usageCountersTable)
      .where(and(...whereConditions));

    const row = rows[0];

    return {
      messages: Number(row?.messages ?? 0),
      tokens: Number(row?.tokens ?? 0),
      estimatedSpendUsd: row?.estimatedSpendUsd ?? '0',
      activeUsers: Number(row?.activeUsers ?? 0)
    };
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
        estimatedSpendTodayUsd: '0',
        updatedAt: new Date()
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
      estimatedSpendTodayUsd: usdAmount(input.estimatedSpendUsd)
    };

    const rows = await this.drizzle.db
      .insert(usageCountersTable)
      .values(values)
      .onConflictDoUpdate({
        target: [usageCountersTable.userId, usageCountersTable.dayPh],
        set: {
          messagesToday: sql`${usageCountersTable.messagesToday} + ${input.messages}`,
          tokensToday: sql`${usageCountersTable.tokensToday} + ${input.tokens}`,
          estimatedSpendTodayUsd: sql`${usageCountersTable.estimatedSpendTodayUsd} + ${usdAmount(input.estimatedSpendUsd)}`
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
        estimatedSpendTodayUsd: '0',
        updatedAt: new Date()
      };
      const spendTodayMicros = usdToMicros(current.estimatedSpendTodayUsd);

      if (current.messagesToday >= input.maxMessages) {
        return { blockedCode: 'daily_message_limit' };
      }

      if (current.tokensToday >= input.maxTokens) {
        return { blockedCode: 'daily_token_limit' };
      }

      if (!usdGreaterThan(input.maxSpendUsd, spendTodayMicros)) {
        return { blockedCode: 'daily_spend_limit' };
      }

      if (current.tokensToday + input.tokens > input.maxTokens) {
        return { blockedCode: 'estimated_token_limit' };
      }

      if (
        usdGreaterThan(
          spendTodayMicros + usdToMicros(input.estimatedSpendUsd),
          input.maxSpendUsd
        )
      ) {
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
        estimatedSpendTodayUsd: usdAmount(input.estimatedSpendUsd)
      })
      .onConflictDoUpdate({
        target: [usageCountersTable.userId, usageCountersTable.dayPh],
        set: {
          messagesToday: sql`greatest(${usageCountersTable.messagesToday} + ${input.messages}, 0)`,
          tokensToday: sql`greatest(${usageCountersTable.tokensToday} + ${input.tokens}, 0)`,
          estimatedSpendTodayUsd: sql`greatest(${usageCountersTable.estimatedSpendTodayUsd} + ${usdAmount(input.estimatedSpendUsd)}, 0)`
        }
      })
      .returning();

    return rows[0];
  }
}
