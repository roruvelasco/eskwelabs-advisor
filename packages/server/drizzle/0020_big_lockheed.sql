ALTER TABLE "knowledge_embeddings" DISABLE ROW LEVEL SECURITY;
DROP INDEX IF EXISTS "knowledge_embeddings_unit_idx";
DROP INDEX IF EXISTS "knowledge_embeddings_provider_idx";
DROP INDEX IF EXISTS "knowledge_embeddings_embedding_idx";

ALTER TABLE "knowledge_embeddings" ALTER COLUMN "dimensions" SET DEFAULT 768;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'published' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "advisor_scope" text DEFAULT 'global' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT '' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'advisor' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "source_revision" text DEFAULT '' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "content_hash" text DEFAULT '' NOT NULL;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "effective_from" timestamp with time zone;
ALTER TABLE "knowledge_embeddings" ADD COLUMN IF NOT EXISTS "effective_to" timestamp with time zone;

DELETE FROM "knowledge_embeddings"
WHERE "unit_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "knowledge_units" WHERE "knowledge_units"."id" = "knowledge_embeddings"."unit_id"
  );

UPDATE "knowledge_embeddings" SET
  "status" = COALESCE("knowledge_units"."status", 'published'),
  "advisor_scope" = COALESCE("knowledge_units"."advisor_scope", 'global'),
  "content_type" = COALESCE("knowledge_units"."content_type", ''),
  "audience" = COALESCE("knowledge_units"."audience", 'advisor'),
  "source_revision" = COALESCE("knowledge_units"."source_revision", ''),
  "content_hash" = COALESCE("knowledge_units"."content_hash", ''),
  "effective_from" = "knowledge_units"."effective_from",
  "effective_to" = "knowledge_units"."effective_to"
FROM "knowledge_units"
WHERE "knowledge_embeddings"."unit_id" = "knowledge_units"."id";

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embeddings_unit_provider_uniq"
  ON "knowledge_embeddings" USING btree ("unit_id", "provider", "model");

CREATE INDEX IF NOT EXISTS "knowledge_embeddings_filter_idx"
  ON "knowledge_embeddings" USING btree ("provider", "model", "status", "advisor_scope", "content_type");

CREATE INDEX IF NOT EXISTS "knowledge_embeddings_published_hnsw_idx"
  ON "knowledge_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE "embedding" IS NOT NULL AND "status" = 'published';

ALTER TABLE "knowledge_embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_embeddings" FORCE ROW LEVEL SECURITY;
