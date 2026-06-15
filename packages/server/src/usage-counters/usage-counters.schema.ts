import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  uuid
} from 'drizzle-orm/pg-core';

import { usersTable } from '../users/users.schema';

export const usageCountersTable = pgTable(
  'usage_counters',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id),
    dayPh: date('day_ph').notNull(),
    messagesToday: integer('messages_today').notNull().default(0),
    tokensToday: integer('tokens_today').notNull().default(0),
    estimatedSpendTodayUsd: numeric('estimated_spend_today_usd')
      .notNull()
      .default('0')
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.dayPh] }),
    dayPhUserIdx: index('usage_counters_day_ph_user_idx').on(
      table.dayPh.desc(),
      table.userId
    )
  })
);

export type UsageCounter = typeof usageCountersTable.$inferSelect;
