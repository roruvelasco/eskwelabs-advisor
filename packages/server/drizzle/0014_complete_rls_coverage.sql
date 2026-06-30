-- ============================================================================
-- 0014_complete_rls_coverage
-- Complete RLS policy coverage for defense-in-depth against direct Supabase API
-- access. Does not change Hono/Drizzle write path — no FORCE ROW LEVEL SECURITY.
-- ============================================================================

-- ─── 1. Re-enable RLS on telemetry_events after 0012 partition swap ───────
-- The partition swap renamed telemetry_events_partitioned → telemetry_events,
-- losing the original ENABLE ROW LEVEL SECURITY. Re-apply here.

ALTER TABLE "telemetry_events" ENABLE ROW LEVEL SECURITY;

-- ─── 2. Enable RLS on tables created after 0012 ────────────────────────────

ALTER TABLE "usage_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_budget_counters" ENABLE ROW LEVEL SECURITY;

-- ─── 3. Drop legacy 0000 policies that use request.jwt.claim.* ─────────────
-- These were superseded by 0012's auth.uid() policies for EIFs. Remove
-- the old request.jwt.claim.* variants to avoid confusion.

DROP POLICY IF EXISTS "users_self_or_admin_select" ON "users";
DROP POLICY IF EXISTS "conversations_owner_or_admin_select" ON "conversations";
DROP POLICY IF EXISTS "messages_owner_or_admin_select" ON "messages";

-- ─── 4. Helper functions for policy USING clauses ──────────────────────────

CREATE OR REPLACE FUNCTION "is_supabase_admin"()
RETURNS boolean AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.role', true), '') = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION "supabase_auth_uid"()
RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. User-owned tables (EIF self-read + admin full access) ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_users'
  ) THEN
    CREATE POLICY "admin_full_users" ON "users"
      FOR ALL
      USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_conversations'
  ) THEN
    CREATE POLICY "admin_full_conversations" ON "conversations"
      FOR ALL
      USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_messages'
  ) THEN
    CREATE POLICY "admin_full_messages" ON "messages"
      FOR ALL
      USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;
END;
$$;

-- ─── 6. Advisors — authenticated read active only; admin full access ───────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_active_advisors'
  ) THEN
    CREATE POLICY "public_read_active_advisors" ON "advisors"
      FOR SELECT
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_advisors'
  ) THEN
    CREATE POLICY "admin_full_advisors" ON "advisors"
      FOR ALL
      USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;
END;
$$;

-- ─── 7. Admin-only tables (model_config, usage_counters, usage_limits, telemetry_events) ──

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_select_model_config'
  ) THEN
    CREATE POLICY "admin_select_model_config" ON "model_config"
      FOR SELECT USING (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_model_config'
  ) THEN
    CREATE POLICY "admin_full_model_config" ON "model_config"
      FOR ALL USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_select_usage_counters'
  ) THEN
    CREATE POLICY "admin_select_usage_counters" ON "usage_counters"
      FOR SELECT USING (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_usage_counters'
  ) THEN
    CREATE POLICY "admin_full_usage_counters" ON "usage_counters"
      FOR ALL USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_select_usage_limits'
  ) THEN
    CREATE POLICY "admin_select_usage_limits" ON "usage_limits"
      FOR SELECT USING (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_usage_limits'
  ) THEN
    CREATE POLICY "admin_full_usage_limits" ON "usage_limits"
      FOR ALL USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_select_telemetry_events'
  ) THEN
    CREATE POLICY "admin_select_telemetry_events" ON "telemetry_events"
      FOR SELECT USING (is_supabase_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin_full_telemetry_events'
  ) THEN
    CREATE POLICY "admin_full_telemetry_events" ON "telemetry_events"
      FOR ALL USING (is_supabase_admin())
      WITH CHECK (is_supabase_admin());
  END IF;
END;
$$;

-- ─── 8. Service-only tables — no direct client policies ────────────────────
-- prompt_snapshots, dna_digests, prompt_cache, advisor_runtime_versions,
-- conversation_title_jobs, usage_budget_counters.
--
-- These tables are intentionally left without SELECT/INSERT/UPDATE/DELETE
-- policies. Access is exclusively through Hono endpoints with server-side
-- authorization. No direct Supabase API access is permitted.
