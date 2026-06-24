import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { knowledgeUnitsTable } from './knowledge-units.schema';

const vector768 = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value as number[];
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as number[];
      } catch {
        return value.slice(1, -1).split(',').map(Number);
      }
    }
    return [];
  }
});

export const knowledgeEmbeddingsTable = pgTable(
  'knowledge_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => knowledgeUnitsTable.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    dimensions: integer('dimensions').default(768),
    embedding: vector768('embedding'),
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
