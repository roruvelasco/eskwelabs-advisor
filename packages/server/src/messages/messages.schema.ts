import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

import { conversationsTable } from '../conversations/conversations.schema';
import { usersTable } from '../users/users.schema';

export const messagesTable = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id),
    role: text('role').notNull(),
    content: text('content').notNull(),
    provider: text('provider'),
    model: text('model'),
    clientTurnId: text('client_turn_id'),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    estimatedCostUsd: numeric('estimated_cost_usd'),
    latencyMs: integer('latency_ms'),
    status: text('status').notNull().default('ok'),
    blockReason: text('block_reason'),
    promptDocRevision: text('prompt_doc_revision'),
    dnaDigestVersion: text('dna_digest_version'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    userClientTurnUnique: uniqueIndex('messages_user_client_turn_unique')
      .on(table.userId, table.clientTurnId)
      .where(sql`${table.clientTurnId} IS NOT NULL`),
    convoCreatedAscIdx: index('messages_convo_created_asc_idx').on(
      table.conversationId,
      table.createdAt.asc(),
      table.id.asc()
    ),
    convoCreatedDescIdx: index('messages_convo_created_desc_idx').on(
      table.conversationId,
      table.createdAt.desc(),
      table.id.desc()
    )
  })
);

export type Message = typeof messagesTable.$inferSelect;
