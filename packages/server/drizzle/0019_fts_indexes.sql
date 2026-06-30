CREATE INDEX IF NOT EXISTS "knowledge_units_fts_idx"
  ON "knowledge_units"
  USING gin(to_tsvector('english', coalesce("text", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("section_path", '')))
  WHERE "status" = 'published';

CREATE INDEX IF NOT EXISTS "knowledge_rules_fts_idx"
  ON "knowledge_rules"
  USING gin(to_tsvector('english', coalesce("topic", '') || ' ' || coalesce("canonical_answer", '')))
  WHERE "status" = 'published';
