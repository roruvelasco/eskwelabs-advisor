-- ============================================================================
-- 0012_db_hardening
-- Soft deletes, updated_at triggers, RLS, telemetry partitioning
-- ============================================================================

-- ─── 1. Soft-delete for conversations ─────────────────────────────────────

ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_status_check";

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_status_check"
  CHECK ("status" IN ('active', 'deleted'));

-- ─── 2. updated_at columns on tables missing them ─────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "advisors"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "advisor_runtime_versions"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "prompt_snapshots"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "dna_digests"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "usage_counters"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- ─── 3. set_updated_at() trigger function ─────────────────────────────────

CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS trigger AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to all tables that now have updated_at
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users',
      'advisors',
      'advisor_runtime_versions',
      'conversations',
      'model_config',
      'prompt_cache',
      'prompt_snapshots',
      'dna_digests',
      'usage_counters',
      'conversation_title_jobs'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS "trg_set_updated_at" ON %I;',
      tbl
    );
    EXECUTE format(
      'CREATE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();',
      tbl
    );
  END LOOP;
END;
$$;

-- ─── 4. RLS enablement (defense-in-depth) ─────────────────────────────────

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advisors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advisor_runtime_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dna_digests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "telemetry_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_title_jobs" ENABLE ROW LEVEL SECURITY;

-- EIF policies for user-owned tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'eif_read_own_users'
  ) THEN
    CREATE POLICY "eif_read_own_users" ON "users"
      FOR SELECT
      USING (auth.uid()::uuid = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'eif_read_own_conversations'
  ) THEN
    CREATE POLICY "eif_read_own_conversations" ON "conversations"
      FOR SELECT
      USING (auth.uid()::uuid = user_id AND deleted_at IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'eif_read_own_messages'
  ) THEN
    CREATE POLICY "eif_read_own_messages" ON "messages"
      FOR SELECT
      USING (
        auth.uid()::uuid = (
          SELECT user_id FROM conversations
          WHERE conversations.id = messages.conversation_id
        )
      );
  END IF;
END;
$$;

-- ─── 5. Telemetry partitioning by month ─────────────────────────────────

-- Create the partitioned replacement table
CREATE TABLE IF NOT EXISTS "telemetry_events_partitioned" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "event_name" text NOT NULL,
  "actor_id" text,
  "severity" text DEFAULT 'info' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "telemetry_events_partitioned_pkey" PRIMARY KEY ("id", "created_at"),
  CONSTRAINT "telemetry_events_partitioned_severity_check"
    CHECK ("severity" IN ('info', 'warning', 'error'))
) PARTITION BY RANGE ("created_at");

-- Current month partition
DO $$
DECLARE
  current_start text;
  next_start text;
BEGIN
  current_start := to_char(date_trunc('month', now()), 'YYYY-MM-DD');
  next_start := to_char(date_trunc('month', now()) + interval '1 month', 'YYYY-MM-DD');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS "telemetry_events_%s" PARTITION OF "telemetry_events_partitioned" FOR VALUES FROM (%L) TO (%L);',
    to_char(date_trunc('month', now()), 'YYYY_MM'),
    current_start,
    next_start
  );
END;
$$;

-- Next month partition
DO $$
DECLARE
  next_start text;
  after_next text;
BEGIN
  next_start := to_char(date_trunc('month', now()) + interval '1 month', 'YYYY-MM-DD');
  after_next := to_char(date_trunc('month', now()) + interval '2 months', 'YYYY-MM-DD');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS "telemetry_events_%s" PARTITION OF "telemetry_events_partitioned" FOR VALUES FROM (%L) TO (%L);',
    to_char(date_trunc('month', now()) + interval '1 month', 'YYYY_MM'),
    next_start,
    after_next
  );
END;
$$;

-- Default partition for future data that doesn't match existing partitions
CREATE TABLE IF NOT EXISTS "telemetry_events_default"
  PARTITION OF "telemetry_events_partitioned" DEFAULT;

-- Copy existing data
INSERT INTO "telemetry_events_partitioned"
  SELECT * FROM "telemetry_events"
  ON CONFLICT DO NOTHING;

-- Swap names
BEGIN;
  ALTER TABLE "telemetry_events" RENAME TO "telemetry_events_old";
  ALTER TABLE "telemetry_events_partitioned" RENAME TO "telemetry_events";
  ALTER INDEX "telemetry_events_partitioned_pkey" RENAME TO "telemetry_events_pkey";

  -- Recreate indexes from original table
  CREATE INDEX IF NOT EXISTS "telemetry_events_event_name_idx" ON "telemetry_events" ("event_name", "created_at" DESC);
  CREATE INDEX IF NOT EXISTS "telemetry_events_actor_id_idx" ON "telemetry_events" ("actor_id", "created_at" DESC);
  CREATE INDEX IF NOT EXISTS "telemetry_events_severity_idx" ON "telemetry_events" ("severity", "created_at" DESC);
COMMIT;
