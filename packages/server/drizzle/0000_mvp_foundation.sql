CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'eif' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"consent_acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"prompt_doc_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "advisors" ("id", "name", "description", "prompt_doc_id")
VALUES
	('data-dashboard', 'Data Dashboard Advisor', 'Dashboard analysis support', NULL),
	('ssot-memo', 'SSOT Memo Advisor', 'Single source of truth memo support', NULL),
	('data-modeling', 'Data Modeling Advisor', 'Data modeling and schema design mentoring', NULL)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"advisor_id" text NOT NULL,
	"title" text DEFAULT 'Untitled conversation' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"provider" text,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"estimated_cost_usd" numeric,
	"latency_ms" integer,
	"status" text DEFAULT 'ok' NOT NULL,
	"block_reason" text,
	"prompt_doc_revision" text,
	"dna_digest_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_config" (
	"advisor_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "model_config" ("advisor_id", "provider", "model", "is_enabled", "updated_by")
VALUES
	('data-dashboard', 'gemini', 'gemini-2.5-flash-lite', true, NULL),
	('ssot-memo', 'gemini', 'gemini-2.5-flash-lite', true, NULL),
	('data-modeling', 'gemini', 'gemini-2.5-flash-lite', true, NULL)
ON CONFLICT ("advisor_id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "prompt_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value_hash" text NOT NULL,
	"doc_revision" text,
	"dna_digest_version" text,
	"last_good_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"user_id" uuid NOT NULL,
	"day_ph" date NOT NULL,
	"messages_today" integer DEFAULT 0 NOT NULL,
	"tokens_today" integer DEFAULT 0 NOT NULL,
	"estimated_spend_today_usd" numeric DEFAULT '0' NOT NULL,
	CONSTRAINT "usage_counters_user_id_day_ph_pk" PRIMARY KEY("user_id","day_ph")
);
--> statement-breakpoint
CREATE TABLE "telemetry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"actor_id" uuid,
	"severity" text DEFAULT 'info' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_config" ADD CONSTRAINT "model_config_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_self_or_admin_select" ON "users"
	FOR SELECT USING (
		"id"::text = current_setting('request.jwt.claim.sub', true)
		OR current_setting('request.jwt.claim.role', true) = 'admin'
	);
--> statement-breakpoint
CREATE POLICY "conversations_owner_or_admin_select" ON "conversations"
	FOR SELECT USING (
		"user_id"::text = current_setting('request.jwt.claim.sub', true)
		OR current_setting('request.jwt.claim.role', true) = 'admin'
	);
--> statement-breakpoint
CREATE POLICY "messages_owner_or_admin_select" ON "messages"
	FOR SELECT USING (
		"user_id"::text = current_setting('request.jwt.claim.sub', true)
		OR current_setting('request.jwt.claim.role', true) = 'admin'
	);
