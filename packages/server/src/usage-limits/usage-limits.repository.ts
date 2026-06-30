import { and, count, desc, eq, gte, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay, getPhilippinesMonth } from '../common/utils/day-ph';
import { telemetryEventsTable } from '../telemetry/telemetry.schema';
import { usageCountersTable } from '../usage-counters/usage-counters.schema';
import {
  usdAmount,
  usdGreaterThan,
  usdToMicros
} from '../usage-counters/money';
import { usersTable } from '../users/users.schema';
import {
  usageLimitAuditEventsTable,
  usageBudgetCountersTable,
  usageLimitsTable,
  type UsageLimitAuditConfig,
  type UsageLimitAuditEvent,
  type UsageBudgetCounter,
  type UsageLimits
} from './usage-limits.schema';

type AdvisoryLockTransaction = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

const DEFAULT_ID = 'default';

type RawUsageBudgetCounter = Partial<UsageBudgetCounter> &
  Record<string, unknown>;

export type UsageLimitsPolicyUsage = {
  peakMessagesPerUserPerDay: number;
  peakTokensPerUserPerDay: number;
  totalMessages: number;
  totalTokens: number;
  activeUsers: number;
};

export type UsageLimitBlockCount = {
  reason: string;
  count: number;
};

export type UsageLimitAuditEventRow = UsageLimitAuditEvent & {
  changedByEmail?: string | null;
};

function toAuditConfig(row: UsageLimits): UsageLimitAuditConfig {
  return {
    maxMessagesPerUserPerDay: row.maxMessagesPerUserPerDay,
    maxTokensPerUserPerDay: row.maxTokensPerUserPerDay,
    dailyBudgetUsd: row.dailyBudgetUsd,
    monthlyBudgetUsd: row.monthlyBudgetUsd,
    rateLimitWindowSeconds: row.rateLimitWindowSeconds,
    rateLimitMaxRequests: row.rateLimitMaxRequests
  };
}

function normalizeBudgetCounter(
  row: RawUsageBudgetCounter | undefined,
  periodKind: 'daily' | 'monthly',
  periodKey: string
): UsageBudgetCounter {
  if (!row) {
    return {
      periodKind,
      periodKey,
      estimatedSpendUsd: '0',
      updatedAt: new Date()
    };
  }

  const snakePeriodKind = row.period_kind;
  const snakePeriodKey = row.period_key;
  const snakeEstimatedSpendUsd = row.estimated_spend_usd;
  const snakeUpdatedAt = row.updated_at;

  return {
    periodKind:
      row.periodKind ??
      (typeof snakePeriodKind === 'string' ? snakePeriodKind : periodKind),
    periodKey:
      row.periodKey ??
      (typeof snakePeriodKey === 'string' ? snakePeriodKey : periodKey),
    estimatedSpendUsd:
      row.estimatedSpendUsd ??
      (typeof snakeEstimatedSpendUsd === 'string'
        ? snakeEstimatedSpendUsd
        : '0'),
    updatedAt:
      row.updatedAt ??
      (snakeUpdatedAt instanceof Date ? snakeUpdatedAt : new Date())
  };
}

export class UsageLimitsRepository extends Repository {
  async getOrThrow(): Promise<UsageLimits> {
    const rows = await this.drizzle.db
      .select()
      .from(usageLimitsTable)
      .where(eq(usageLimitsTable.id, DEFAULT_ID))
      .limit(1);

    if (!rows[0]) {
      const inserted = await this.drizzle.db
        .insert(usageLimitsTable)
        .values({ id: DEFAULT_ID })
        .onConflictDoNothing()
        .returning();

      if (inserted[0]) return inserted[0];

      const refetched = await this.drizzle.db
        .select()
        .from(usageLimitsTable)
        .where(eq(usageLimitsTable.id, DEFAULT_ID))
        .limit(1);

      return refetched[0]!;
    }

    return rows[0];
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
    return this.drizzle.db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(usageLimitsTable)
        .where(eq(usageLimitsTable.id, DEFAULT_ID))
        .limit(1);
      const previous = existingRows[0] ? toAuditConfig(existingRows[0]) : null;
      const now = new Date();
      const rows = await tx
        .insert(usageLimitsTable)
        .values({
          id: DEFAULT_ID,
          maxMessagesPerUserPerDay: input.maxMessagesPerUserPerDay,
          maxTokensPerUserPerDay: input.maxTokensPerUserPerDay,
          dailyBudgetUsd: input.dailyBudgetUsd,
          monthlyBudgetUsd: input.monthlyBudgetUsd,
          rateLimitWindowSeconds: input.rateLimitWindowSeconds,
          rateLimitMaxRequests: input.rateLimitMaxRequests,
          updatedBy: input.updatedBy,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: usageLimitsTable.id,
          set: {
            maxMessagesPerUserPerDay: input.maxMessagesPerUserPerDay,
            maxTokensPerUserPerDay: input.maxTokensPerUserPerDay,
            dailyBudgetUsd: input.dailyBudgetUsd,
            monthlyBudgetUsd: input.monthlyBudgetUsd,
            rateLimitWindowSeconds: input.rateLimitWindowSeconds,
            rateLimitMaxRequests: input.rateLimitMaxRequests,
            updatedBy: input.updatedBy,
            updatedAt: now
          }
        })
        .returning();
      const next = rows[0];

      await tx.insert(usageLimitAuditEventsTable).values({
        changedBy: input.updatedBy,
        previousConfig: previous,
        nextConfig: toAuditConfig(next),
        createdAt: now
      });

      return next;
    });
  }

  async policyUsage({
    fromDayPh,
    toDayPh
  }: {
    fromDayPh: string;
    toDayPh: string;
  }): Promise<UsageLimitsPolicyUsage> {
    const rows = await this.drizzle.db
      .select({
        peakMessagesPerUserPerDay: sql<number>`coalesce(max(${usageCountersTable.messagesToday}), 0)`,
        peakTokensPerUserPerDay: sql<number>`coalesce(max(${usageCountersTable.tokensToday}), 0)`,
        totalMessages: sql<number>`coalesce(sum(${usageCountersTable.messagesToday}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${usageCountersTable.tokensToday}), 0)`,
        activeUsers: sql<number>`count(distinct ${usageCountersTable.userId})`
      })
      .from(usageCountersTable)
      .where(
        and(
          gte(usageCountersTable.dayPh, fromDayPh),
          sql`${usageCountersTable.dayPh} <= ${toDayPh}`
        )
      );

    const row = rows[0];

    return {
      peakMessagesPerUserPerDay: Number(row?.peakMessagesPerUserPerDay ?? 0),
      peakTokensPerUserPerDay: Number(row?.peakTokensPerUserPerDay ?? 0),
      totalMessages: Number(row?.totalMessages ?? 0),
      totalTokens: Number(row?.totalTokens ?? 0),
      activeUsers: Number(row?.activeUsers ?? 0)
    };
  }

  async blockCountsSince(since: Date): Promise<UsageLimitBlockCount[]> {
    const reason = sql<string>`coalesce(${telemetryEventsTable.payload}->>'reason', 'unknown')`;
    const rows = await this.drizzle.db
      .select({
        reason,
        count: count()
      })
      .from(telemetryEventsTable)
      .where(
        and(
          eq(telemetryEventsTable.eventName, 'request_blocked'),
          gte(telemetryEventsTable.createdAt, since)
        )
      )
      .groupBy(reason);

    return rows.map((row) => ({
      reason: row.reason,
      count: Number(row.count)
    }));
  }

  async listAuditEvents(limit = 10): Promise<UsageLimitAuditEventRow[]> {
    return this.drizzle.db
      .select({
        id: usageLimitAuditEventsTable.id,
        changedBy: usageLimitAuditEventsTable.changedBy,
        changedByEmail: usersTable.email,
        previousConfig: usageLimitAuditEventsTable.previousConfig,
        nextConfig: usageLimitAuditEventsTable.nextConfig,
        createdAt: usageLimitAuditEventsTable.createdAt
      })
      .from(usageLimitAuditEventsTable)
      .leftJoin(
        usersTable,
        sql`${usersTable.id}::text = ${usageLimitAuditEventsTable.changedBy}`
      )
      .orderBy(desc(usageLimitAuditEventsTable.createdAt))
      .limit(limit);
  }

  async findGlobalBudget(
    periodKind: 'daily' | 'monthly',
    periodKey?: string
  ): Promise<UsageBudgetCounter> {
    const key =
      periodKey ??
      (periodKind === 'daily' ? getPhilippinesDay() : getPhilippinesMonth());

    const rows = await this.drizzle.db
      .select()
      .from(usageBudgetCountersTable)
      .where(
        sql`${usageBudgetCountersTable.periodKind} = ${periodKind} and ${usageBudgetCountersTable.periodKey} = ${key}`
      )
      .limit(1);

    return (
      rows[0] ?? {
        periodKind,
        periodKey: key,
        estimatedSpendUsd: '0',
        updatedAt: new Date()
      }
    );
  }

  async reserveGlobalBudget(
    estimatedCostUsd: number,
    limits: Pick<UsageLimits, 'dailyBudgetUsd' | 'monthlyBudgetUsd'>
  ): Promise<{ blockedCode?: string }> {
    const day = getPhilippinesDay();
    const month = getPhilippinesMonth();

    return this.drizzle.db.transaction(async (tx) => {
      await this.lockGlobalBudget(tx, 'daily', day);
      await this.lockGlobalBudget(tx, 'monthly', month);

      const dailyCurrent = await this.getGlobalBudgetTx(tx, 'daily', day);
      const monthlyCurrent = await this.getGlobalBudgetTx(tx, 'monthly', month);

      const dailySpendMicros = usdToMicros(dailyCurrent.estimatedSpendUsd);
      const monthlySpendMicros = usdToMicros(monthlyCurrent.estimatedSpendUsd);
      const estimatedMicros = usdToMicros(estimatedCostUsd);

      if (
        !usdGreaterThan(
          limits.dailyBudgetUsd,
          dailySpendMicros + estimatedMicros
        )
      ) {
        return { blockedCode: 'daily_budget_limit' };
      }

      if (
        !usdGreaterThan(
          limits.monthlyBudgetUsd,
          monthlySpendMicros + estimatedMicros
        )
      ) {
        return { blockedCode: 'monthly_budget_limit' };
      }

      await this.upsertGlobalBudgetTx(tx, 'daily', day, estimatedCostUsd);
      await this.upsertGlobalBudgetTx(tx, 'monthly', month, estimatedCostUsd);

      return {};
    });
  }

  async finalizeGlobalReservation(input: {
    estimatedCostUsd: number;
    actualCostUsd: number;
  }) {
    const day = getPhilippinesDay();
    const month = getPhilippinesMonth();

    return this.drizzle.db.transaction(async (tx) => {
      await this.lockGlobalBudget(tx, 'daily', day);
      await this.lockGlobalBudget(tx, 'monthly', month);

      const delta = input.actualCostUsd - input.estimatedCostUsd;
      if (delta !== 0) {
        await this.upsertGlobalBudgetTx(tx, 'daily', day, delta);
        await this.upsertGlobalBudgetTx(tx, 'monthly', month, delta);
      }
    });
  }

  async releaseGlobalReservation(estimatedCostUsd: number) {
    const day = getPhilippinesDay();
    const month = getPhilippinesMonth();

    return this.drizzle.db.transaction(async (tx) => {
      await this.lockGlobalBudget(tx, 'daily', day);
      await this.lockGlobalBudget(tx, 'monthly', month);

      await this.upsertGlobalBudgetTx(tx, 'daily', day, -estimatedCostUsd);
      await this.upsertGlobalBudgetTx(tx, 'monthly', month, -estimatedCostUsd);
    });
  }

  private async lockGlobalBudget(
    tx: AdvisoryLockTransaction,
    periodKind: string,
    periodKey: string
  ) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('global_budget'), hashtext(${periodKind} || '_' || ${periodKey}))`
    );
  }

  private async getGlobalBudgetTx(
    tx: AdvisoryLockTransaction,
    periodKind: 'daily' | 'monthly',
    periodKey: string
  ): Promise<UsageBudgetCounter> {
    const rows = (await tx.execute(
      sql`select * from ${usageBudgetCountersTable} where ${usageBudgetCountersTable.periodKind} = ${periodKind} and ${usageBudgetCountersTable.periodKey} = ${periodKey} limit 1`
    )) as unknown as RawUsageBudgetCounter[];

    return normalizeBudgetCounter(rows[0], periodKind, periodKey);
  }

  private async upsertGlobalBudgetTx(
    tx: AdvisoryLockTransaction,
    periodKind: string,
    periodKey: string,
    spendDelta: number
  ) {
    const amount = usdAmount(spendDelta);
    const sign = spendDelta < 0 ? '-' : '+';

    await tx.execute(
      sql`insert into ${usageBudgetCountersTable} (period_kind, period_key, estimated_spend_usd) values (${periodKind}, ${periodKey}, ${usdAmount(Math.max(0, spendDelta))}) on conflict (period_kind, period_key) do update set estimated_spend_usd = greatest(${usageBudgetCountersTable.estimatedSpendUsd} ${sql.raw(sign)} ${amount}, 0)`
    );
  }
}
