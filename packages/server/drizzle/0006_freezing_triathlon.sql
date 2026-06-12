CREATE TABLE "conversation_title_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_title_jobs_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "title_source" text DEFAULT 'legacy' NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "title_source" SET DEFAULT 'fallback';--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD CONSTRAINT "conversation_title_jobs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_title_jobs_claim_idx" ON "conversation_title_jobs" USING btree ("status","run_after","created_at");--> statement-breakpoint
CREATE INDEX "conversation_title_jobs_stale_idx" ON "conversation_title_jobs" USING btree ("status","lease_expires_at");