import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const advisorsTable = pgTable('advisors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type Advisor = typeof advisorsTable.$inferSelect;
