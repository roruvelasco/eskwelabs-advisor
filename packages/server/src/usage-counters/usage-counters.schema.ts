import {
  date,
  integer,
  numeric,
  pgTable,
  primaryKey,
  uuid
} from 'drizzle-orm/pg-core';

export const usageCountersTable = pgTable(
  'usage_counters',
  {
    userId: uuid('user_id').notNull(),
    dayPh: date('day_ph').notNull(),
    messagesToday: integer('messages_today').notNull().default(0),
    tokensToday: integer('tokens_today').notNull().default(0),
    estimatedSpendTodayUsd: numeric('estimated_spend_today_usd')
      .notNull()
      .default('0')
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.dayPh] })
  })
);
