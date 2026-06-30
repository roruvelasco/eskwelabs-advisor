import {
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

export type UsageLimitAuditConfig = {
  maxMessagesPerUserPerDay: number;
  maxTokensPerUserPerDay: number;
  dailyBudgetUsd: string;
  monthlyBudgetUsd: string;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
};

export const usageLimitsTable = pgTable('usage_limits', {
  id: text('id').primaryKey().default('default'),
  maxMessagesPerUserPerDay: integer('max_messages_per_user_per_day')
    .notNull()
    .default(25),
  maxTokensPerUserPerDay: integer('max_tokens_per_user_per_day')
    .notNull()
    .default(100000),
  dailyBudgetUsd: numeric('daily_budget_usd').notNull().default('10'),
  monthlyBudgetUsd: numeric('monthly_budget_usd').notNull().default('300'),
  rateLimitWindowSeconds: integer('rate_limit_window_seconds')
    .notNull()
    .default(60),
  rateLimitMaxRequests: integer('rate_limit_max_requests')
    .notNull()
    .default(100),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type UsageLimits = typeof usageLimitsTable.$inferSelect;

export const usageBudgetCountersTable = pgTable(
  'usage_budget_counters',
  {
    periodKind: text('period_kind').notNull(),
    periodKey: text('period_key').notNull(),
    estimatedSpendUsd: numeric('estimated_spend_usd').notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.periodKind, table.periodKey] })
  })
);

export type UsageBudgetCounter = typeof usageBudgetCountersTable.$inferSelect;

export const usageLimitAuditEventsTable = pgTable('usage_limit_audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  changedBy: text('changed_by'),
  previousConfig: jsonb(
    'previous_config'
  ).$type<UsageLimitAuditConfig | null>(),
  nextConfig: jsonb('next_config').$type<UsageLimitAuditConfig>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type UsageLimitAuditEvent =
  typeof usageLimitAuditEventsTable.$inferSelect;
