import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const promptCacheTable = pgTable(
  'prompt_cache',
  {
    key: text('key').primaryKey(),
    valueHash: text('value_hash').notNull(),
    docRevision: text('doc_revision'),
    dnaDigestVersion: text('dna_digest_version'),
    lastGoodAt: timestamp('last_good_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    updatedKeyIdx: index('prompt_cache_updated_key_idx').on(
      table.updatedAt.desc(),
      table.key
    )
  })
);

export type PromptCacheEntry = typeof promptCacheTable.$inferSelect;
