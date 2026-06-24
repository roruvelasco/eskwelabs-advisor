import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { messagesTable } from '../messages/messages.schema';
import { knowledgeRulesTable } from './knowledge-rules.schema';
import { knowledgeUnitsTable } from './knowledge-units.schema';

export const messageKnowledgeAuditTable = pgTable(
  'message_knowledge_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messagesTable.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => knowledgeUnitsTable.id, {
      onDelete: 'set null'
    }),
    ruleId: uuid('rule_id').references(() => knowledgeRulesTable.id, {
      onDelete: 'set null'
    }),
    sourceRevision: text('source_revision'),
    contentHash: text('content_hash'),
    selectionRank: integer('selection_rank').notNull().default(0),
    score: numeric('score'),
    resolverStrategy: text('resolver_strategy').notNull(),
    usedInPrompt: boolean('used_in_prompt').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    auditMessageIdx: index('message_knowledge_audit_message_idx').on(
      table.messageId
    ),
    auditUnitIdx: index('message_knowledge_audit_unit_idx').on(table.unitId),
    auditRuleIdx: index('message_knowledge_audit_rule_idx').on(table.ruleId)
  })
);

export type MessageKnowledgeAudit =
  typeof messageKnowledgeAuditTable.$inferSelect;
