import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { knowledgeUnitsTable } from './knowledge-units.schema';

export const knowledgeEmbeddingsTable = pgTable(
  'knowledge_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => knowledgeUnitsTable.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    dimensions: integer('dimensions'),
    vectorPayload: jsonb('vector_payload').$type<number[] | null>(),
    externalVectorId: text('external_vector_id'),
    embeddingHash: text('embedding_hash').notNull(),
    indexedAt: timestamp('indexed_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    embeddingUnitIdx: index('knowledge_embeddings_unit_idx').on(table.unitId),
    embeddingProviderIdx: index('knowledge_embeddings_provider_idx').on(
      table.provider,
      table.model
    )
  })
);

export type KnowledgeEmbedding = typeof knowledgeEmbeddingsTable.$inferSelect;
