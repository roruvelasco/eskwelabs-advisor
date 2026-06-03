import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const conversationsTable = pgTable('conversations', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: uuid('user_id').notNull(),
  advisorId: text('advisor_id').notNull(),
  title: text('title').notNull().default('Untitled conversation'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type Conversation = typeof conversationsTable.$inferSelect;
