DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM conversation_title_jobs
  ) THEN
    RAISE EXCEPTION 'Cannot add exact title-job message references while title jobs exist';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD COLUMN "user_message_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD COLUMN "assistant_message_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD CONSTRAINT "conversation_title_jobs_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD CONSTRAINT "conversation_title_jobs_assistant_message_id_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
