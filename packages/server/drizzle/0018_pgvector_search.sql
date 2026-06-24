CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_embeddings" DROP COLUMN IF EXISTS "vector_payload";

ALTER TABLE "knowledge_embeddings" ADD COLUMN "embedding" vector(768);

CREATE INDEX "knowledge_embeddings_embedding_idx" ON "knowledge_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
