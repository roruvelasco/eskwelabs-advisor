import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { knowledgeUnitsTable } from './knowledge-units.schema';

export const knowledgeRulesTable = pgTable(
  'knowledge_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    appliesTo: jsonb('applies_to').$type<Record<string, unknown>>().default({}),
    canonicalAnswer: text('canonical_answer').notNull(),
    sourceUnitId: uuid('source_unit_id').references(
      () => knowledgeUnitsTable.id,
      {
        onDelete: 'set null'
      }
    ),
    priority: integer('priority').notNull().default(0),
    status: text('status').notNull().default('published'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    ruleTopicStatusIdx: index('knowledge_rules_topic_status_idx').on(
      table.topic,
      table.status,
      table.priority
    ),
    ruleStatusCheck: check(
      'knowledge_rules_status_check',
      sql`${table.status} in ('draft', 'published', 'retired')`
    )
  })
);

export type KnowledgeRule = typeof knowledgeRulesTable.$inferSelect;
