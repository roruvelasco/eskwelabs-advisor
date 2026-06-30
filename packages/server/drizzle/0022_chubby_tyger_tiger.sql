CREATE TABLE "usage_limit_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changed_by" text,
	"previous_config" jsonb,
	"next_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "usage_limit_audit_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_usage_limit_audit_events" ON "usage_limit_audit_events"
  FOR SELECT USING (is_supabase_admin());

CREATE POLICY "admin_full_usage_limit_audit_events" ON "usage_limit_audit_events"
  FOR ALL USING (is_supabase_admin())
  WITH CHECK (is_supabase_admin());
