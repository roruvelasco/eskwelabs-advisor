import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const dnaDigestsTable = pgTable(
  'dna_digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    docId: text('doc_id').notNull(),
    revision: text('revision').notNull(),
    sourceHash: text('source_hash').notNull().default(''),
    digestText: text('digest_text').notNull(),
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
    oneActiveDnaDigest: uniqueIndex('dna_digests_one_active_idx')
      .on(table.isActive)
      .where(sql`${table.isActive} = true`)
  })
);

export type DnaDigestRow = typeof dnaDigestsTable.$inferSelect;
