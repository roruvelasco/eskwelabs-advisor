import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

export const knowledgeSourcesTable = pgTable(
  'knowledge_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceType: text('source_type').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    owner: text('owner'),
    status: text('status').notNull().default('draft'),
    audience: text('audience').notNull().default('advisor'),
    advisorScope: text('advisor_scope').notNull().default('global'),
    contentType: text('content_type').notNull().default('advisor_reference'),
    revision: text('revision'),
    sourceHash: text('source_hash'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    lastIngestedAt: timestamp('last_ingested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    sourceExternalIdx: index('knowledge_sources_external_idx').on(
      table.sourceType,
      table.externalId
    ),
    sourceStatusIdx: index('knowledge_sources_status_idx').on(
      table.status,
      table.updatedAt.desc()
    ),
    sourceStatusCheck: check(
      'knowledge_sources_status_check',
      sql`${table.status} in ('draft', 'published', 'retired', 'failed')`
    ),
    sourceTypeCheck: check(
      'knowledge_sources_source_type_check',
      sql`${table.sourceType} in ('google_doc', 'manual', 'sheet', 'lms', 'external')`
    )
  })
);

export type KnowledgeSource = typeof knowledgeSourcesTable.$inferSelect;
