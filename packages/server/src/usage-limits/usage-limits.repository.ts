import { eq, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay, getPhilippinesMonth } from '../common/utils/day-ph';
import {
  usdAmount,
  usdGreaterThan,
  usdToMicros
} from '../usage-counters/money';
import {
  usageBudgetCountersTable,
  usageLimitsTable,
  type UsageBudgetCounter,
  type UsageLimits
} from './usage-limits.schema';

type AdvisoryLockTransaction = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

const DEFAULT_ID = 'default';

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
    const rows = await this.drizzle.db
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
        updatedAt: new Date()
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
          updatedAt: new Date()
        }
      })
      .returning();

    return rows[0];
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
    periodKind: string,
    periodKey: string
  ): Promise<UsageBudgetCounter> {
    const rows = (await tx.execute(
      sql`select * from ${usageBudgetCountersTable} where ${usageBudgetCountersTable.periodKind} = ${periodKind} and ${usageBudgetCountersTable.periodKey} = ${periodKey} limit 1`
    )) as unknown as UsageBudgetCounter[];

    return (
      rows[0] ?? {
        periodKind,
        periodKey,
        estimatedSpendUsd: '0',
        updatedAt: new Date()
      }
    );
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
