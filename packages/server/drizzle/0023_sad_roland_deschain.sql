CREATE TABLE "conversation_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_shares" ADD CONSTRAINT "conversation_shares_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_shares" ADD CONSTRAINT "conversation_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_shares_share_id_unique" ON "conversation_shares" USING btree ("share_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_shares_conversation_unique" ON "conversation_shares" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "conversation_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "eif_read_own_conversation_shares" ON "conversation_shares"
  FOR SELECT
  USING (auth.uid()::uuid = created_by);--> statement-breakpoint
CREATE POLICY "admin_full_conversation_shares" ON "conversation_shares"
  FOR ALL USING (is_supabase_admin())
  WITH CHECK (is_supabase_admin());