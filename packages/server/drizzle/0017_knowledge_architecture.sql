CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"owner" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"audience" text DEFAULT 'advisor' NOT NULL,
	"advisor_scope" text DEFAULT 'global' NOT NULL,
	"content_type" text DEFAULT 'advisor_reference' NOT NULL,
	"revision" text,
	"source_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_ingested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_status_check" CHECK ("knowledge_sources"."status" in ('draft', 'published', 'retired', 'failed')),
	CONSTRAINT "knowledge_sources_source_type_check" CHECK ("knowledge_sources"."source_type" in ('google_doc', 'manual', 'sheet', 'lms', 'external'))
);
--> statement-breakpoint
CREATE TABLE "knowledge_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_revision" text NOT NULL,
	"section_path" text DEFAULT '' NOT NULL,
	"content_type" text NOT NULL,
	"advisor_scope" text DEFAULT 'global' NOT NULL,
	"audience" text DEFAULT 'advisor' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"text" text NOT NULL,
	"summary" text,
	"content_hash" text NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_units_status_check" CHECK ("knowledge_units"."status" in ('draft', 'published', 'retired')),
	CONSTRAINT "knowledge_units_content_type_check" CHECK ("knowledge_units"."content_type" in ('policy', 'faq', 'course_material', 'mentor_guide', 'rubric', 'ops_rule', 'advisor_reference', 'behavior_reference'))
);
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer,
	"vector_payload" jsonb,
	"external_vector_id" text,
	"embedding_hash" text NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"applies_to" jsonb DEFAULT '{}'::jsonb,
	"canonical_answer" text NOT NULL,
	"source_unit_id" uuid,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_rules_status_check" CHECK ("knowledge_rules"."status" in ('draft', 'published', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "message_knowledge_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"unit_id" uuid,
	"rule_id" uuid,
	"source_revision" text,
	"content_hash" text,
	"selection_rank" integer DEFAULT 0 NOT NULL,
	"score" numeric,
	"resolver_strategy" text NOT NULL,
	"used_in_prompt" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "knowledge_context_hash" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "knowledge_resolution_mode" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "knowledge_unit_count" integer;--> statement-breakpoint
ALTER TABLE "knowledge_units" ADD CONSTRAINT "knowledge_units_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_unit_id_knowledge_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."knowledge_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_rules" ADD CONSTRAINT "knowledge_rules_source_unit_id_knowledge_units_id_fk" FOREIGN KEY ("source_unit_id") REFERENCES "public"."knowledge_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_knowledge_audit" ADD CONSTRAINT "message_knowledge_audit_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_knowledge_audit" ADD CONSTRAINT "message_knowledge_audit_unit_id_knowledge_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."knowledge_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_knowledge_audit" ADD CONSTRAINT "message_knowledge_audit_rule_id_knowledge_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."knowledge_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_sources_external_idx" ON "knowledge_sources" USING btree ("source_type","external_id");--> statement-breakpoint
CREATE INDEX "knowledge_sources_status_idx" ON "knowledge_sources" USING btree ("status","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "knowledge_units_source_revision_idx" ON "knowledge_units" USING btree ("source_id","source_revision");--> statement-breakpoint
CREATE INDEX "knowledge_units_scope_status_idx" ON "knowledge_units" USING btree ("advisor_scope","status","content_type");--> statement-breakpoint
CREATE INDEX "knowledge_units_hash_idx" ON "knowledge_units" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_unit_idx" ON "knowledge_embeddings" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "knowledge_embeddings_provider_idx" ON "knowledge_embeddings" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "knowledge_rules_topic_status_idx" ON "knowledge_rules" USING btree ("topic","status","priority");--> statement-breakpoint
CREATE INDEX "message_knowledge_audit_message_idx" ON "message_knowledge_audit" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_knowledge_audit_unit_idx" ON "message_knowledge_audit" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "message_knowledge_audit_rule_idx" ON "message_knowledge_audit" USING btree ("rule_id");--> statement-breakpoint
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "knowledge_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_knowledge_audit" ENABLE ROW LEVEL SECURITY;
