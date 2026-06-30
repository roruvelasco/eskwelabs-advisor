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

import { knowledgeSourcesTable } from './knowledge-sources.schema';

export const knowledgeUnitsTable = pgTable(
  'knowledge_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => knowledgeSourcesTable.id, { onDelete: 'cascade' }),
    sourceRevision: text('source_revision').notNull(),
    sectionPath: text('section_path').notNull().default(''),
    contentType: text('content_type').notNull(),
    advisorScope: text('advisor_scope').notNull().default('global'),
    audience: text('audience').notNull().default('advisor'),
    status: text('status').notNull().default('published'),
    text: text('text').notNull(),
    summary: text('summary'),
    contentHash: text('content_hash').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    unitSourceRevisionIdx: index('knowledge_units_source_revision_idx').on(
      table.sourceId,
      table.sourceRevision
    ),
    unitScopeStatusIdx: index('knowledge_units_scope_status_idx').on(
      table.advisorScope,
      table.status,
      table.contentType
    ),
    unitHashIdx: index('knowledge_units_hash_idx').on(table.contentHash),
    unitStatusCheck: check(
      'knowledge_units_status_check',
      sql`${table.status} in ('draft', 'published', 'retired')`
    ),
    unitContentTypeCheck: check(
      'knowledge_units_content_type_check',
      sql`${table.contentType} in ('policy', 'faq', 'course_material', 'mentor_guide', 'rubric', 'ops_rule', 'advisor_reference', 'behavior_reference')`
    )
  })
);

export type KnowledgeUnit = typeof knowledgeUnitsTable.$inferSelect;
