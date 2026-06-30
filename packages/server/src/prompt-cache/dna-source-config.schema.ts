import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const dnaSourceConfigTable = pgTable('dna_source_config', {
  id: text('id').primaryKey().default('default'),
  docId: text('doc_id').notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type DnaSourceConfigRow = typeof dnaSourceConfigTable.$inferSelect;
