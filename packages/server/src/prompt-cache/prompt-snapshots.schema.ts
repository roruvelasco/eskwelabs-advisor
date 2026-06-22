import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const promptSnapshotsTable = pgTable(
  'prompt_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    advisorId: text('advisor_id').notNull(),
    docId: text('doc_id').notNull(),
    revision: text('revision').notNull(),
    contentText: text('content_text').notNull(),
    hash: text('hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    oneActivePromptSnapshotPerAdvisor: uniqueIndex(
      'prompt_snapshots_one_active_per_advisor_idx'
    )
      .on(table.advisorId)
      .where(sql`${table.isActive} = true`)
  })
);

export type PromptSnapshotRow = typeof promptSnapshotsTable.$inferSelect;
