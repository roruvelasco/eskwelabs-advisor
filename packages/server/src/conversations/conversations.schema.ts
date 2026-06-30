import {
  type AnyPgColumn,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { advisorRuntimeVersionsTable } from '../advisors/advisor-runtime.schema';
import { advisorsTable } from '../advisors/advisors.schema';
import { usersTable } from '../users/users.schema';

export const TITLE_SOURCE_VALUES = [
  'legacy',
  'fallback',
  'generated',
  'manual'
] as const;

export type TitleSource = (typeof TITLE_SOURCE_VALUES)[number];

export type ConversationTitleSource = TitleSource;

export const conversationsTable = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id),
    advisorId: text('advisor_id')
      .notNull()
      .references(() => advisorsTable.id),
    advisorRuntimeVersionId: uuid('advisor_runtime_version_id').references(
      (): AnyPgColumn => advisorRuntimeVersionsTable.id
    ),
    title: text('title').notNull().default('Untitled conversation'),
    titleSource: text('title_source').notNull().default('fallback'),
    status: text('status').notNull().default('active'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    statusCheck: check(
      'conversations_status_check',
      sql`${table.status} in ('active', 'deleted')`
    ),
    titleSourceCheck: check(
      'conversations_title_source_check',
      sql`${table.titleSource} in ('legacy', 'fallback', 'generated', 'manual')`
    ),
    userUpdatedIdx: index('conversations_user_updated_idx').on(
      table.userId,
      table.updatedAt.desc(),
      table.id.desc()
    ),
    userAdvisorUpdatedIdx: index('conversations_user_advisor_updated_idx').on(
      table.userId,
      table.advisorId,
      table.updatedAt.desc(),
      table.id.desc()
    )
  })
);

export type Conversation = typeof conversationsTable.$inferSelect;
