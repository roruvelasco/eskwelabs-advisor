import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { advisorsTable } from './advisors.schema';
import { modelConfigTable } from '../model-config/model-config.schema';
import { promptSnapshotsTable } from '../prompt-cache/prompt-snapshots.schema';
import { dnaDigestsTable } from '../prompt-cache/dna-digests.schema';

export const advisorRuntimeVersionsTable = pgTable(
  'advisor_runtime_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    advisorId: text('advisor_id')
      .notNull()
      .references((): AnyPgColumn => advisorsTable.id),
    promptSnapshotId: uuid('prompt_snapshot_id').references(
      () => promptSnapshotsTable.id
    ),
    dnaDigestId: uuid('dna_digest_id').references(() => dnaDigestsTable.id),
    modelConfigAdvisorId: text('model_config_advisor_id')
      .notNull()
      .references((): AnyPgColumn => modelConfigTable.advisorId),
    versionNumber: integer('version_number').notNull(),
    status: text('status').notNull().default('published'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    advisorStatusVersionIdx: index(
      'advisor_runtime_versions_advisor_status_version_idx'
    ).on(table.advisorId, table.status, table.versionNumber.desc())
  })
);

export type AdvisorRuntimeVersion =
  typeof advisorRuntimeVersionsTable.$inferSelect;
