import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

export const messagesTable = pgTable('messages', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  conversationId: uuid('conversation_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  provider: text('provider'),
  model: text('model'),
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
});

export type Message = typeof messagesTable.$inferSelect;
