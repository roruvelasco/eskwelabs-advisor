CREATE TABLE "advisor_runtime_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" text NOT NULL,
	"prompt_snapshot_id" uuid,
	"dna_digest_id" uuid,
	"model_config_advisor_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisors" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "advisors" ADD COLUMN "active_runtime_version_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "advisor_runtime_version_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "client_turn_id" text;--> statement-breakpoint
ALTER TABLE "advisor_runtime_versions" ADD CONSTRAINT "advisor_runtime_versions_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_runtime_versions" ADD CONSTRAINT "advisor_runtime_versions_prompt_snapshot_id_prompt_snapshots_id_fk" FOREIGN KEY ("prompt_snapshot_id") REFERENCES "public"."prompt_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_runtime_versions" ADD CONSTRAINT "advisor_runtime_versions_dna_digest_id_dna_digests_id_fk" FOREIGN KEY ("dna_digest_id") REFERENCES "public"."dna_digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_runtime_versions" ADD CONSTRAINT "advisor_runtime_versions_model_config_advisor_id_model_config_advisor_id_fk" FOREIGN KEY ("model_config_advisor_id") REFERENCES "public"."model_config"("advisor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_user_client_turn_unique" ON "messages" USING btree ("user_id","client_turn_id") WHERE "messages"."client_turn_id" IS NOT NULL;