import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { advisorsTable } from '../advisors/advisors.schema';
import { usersTable } from '../users/users.schema';

export const conversationsTable = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id),
  advisorId: text('advisor_id')
    .notNull()
    .references(() => advisorsTable.id),
  advisorRuntimeVersionId: uuid('advisor_runtime_version_id'),
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
