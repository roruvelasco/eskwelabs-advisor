import {
  type AnyPgColumn,
  boolean,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { advisorRuntimeVersionsTable } from './advisor-runtime.schema';

export const advisorsTable = pgTable('advisors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  promptDocId: text('prompt_doc_id'),
  isActive: boolean('is_active').notNull().default(true),
  status: text('status').notNull().default('active'),
  activeRuntimeVersionId: uuid('active_runtime_version_id').references(
    (): AnyPgColumn => advisorRuntimeVersionsTable.id
  ),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type Advisor = typeof advisorsTable.$inferSelect;
