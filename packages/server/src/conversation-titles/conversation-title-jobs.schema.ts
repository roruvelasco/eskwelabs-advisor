import {
  index,
  pgTable,
  uuid,
  text,
  integer,
  timestamp
} from 'drizzle-orm/pg-core';
import { conversationsTable } from '../conversations/conversations.schema';
import { messagesTable } from '../messages/messages.schema';

export const conversationTitleJobsTable = pgTable(
  'conversation_title_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' })
      .unique(),
    userMessageId: uuid('user_message_id')
      .notNull()
      .references(() => messagesTable.id, { onDelete: 'cascade' }),
    assistantMessageId: uuid('assistant_message_id')
      .notNull()
      .references(() => messagesTable.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAfter: timestamp('run_after', { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    claimIdx: index('conversation_title_jobs_claim_idx').on(
      table.status,
      table.runAfter,
      table.createdAt
    ),
    staleIdx: index('conversation_title_jobs_stale_idx').on(
      table.status,
      table.leaseExpiresAt
    )
  })
);
