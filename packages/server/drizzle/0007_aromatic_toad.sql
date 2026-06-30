ALTER TABLE "conversation_title_jobs" ADD COLUMN "user_message_id" uuid;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD COLUMN "assistant_message_id" uuid;
--> statement-breakpoint
WITH user_candidates AS (
  SELECT
    job.id AS job_id,
    message.id AS user_message_id,
    row_number() OVER (
      PARTITION BY job.id
      ORDER BY message.created_at DESC, message.id DESC
    ) AS rn
  FROM conversation_title_jobs job
  JOIN messages message
    ON message.conversation_id = job.conversation_id
  WHERE message.role = 'user'
    AND message.status = 'ok'
),
assistant_candidates AS (
  SELECT
    job.id AS job_id,
    message.id AS assistant_message_id,
    row_number() OVER (
      PARTITION BY job.id
      ORDER BY message.created_at DESC, message.id DESC
    ) AS rn
  FROM conversation_title_jobs job
  JOIN messages message
    ON message.conversation_id = job.conversation_id
  WHERE message.role = 'assistant'
    AND message.status = 'ok'
)
UPDATE conversation_title_jobs job
SET
  user_message_id = user_candidates.user_message_id,
  assistant_message_id = assistant_candidates.assistant_message_id
FROM user_candidates
JOIN assistant_candidates
  ON assistant_candidates.job_id = user_candidates.job_id
WHERE job.id = user_candidates.job_id
  AND user_candidates.rn = 1
  AND assistant_candidates.rn = 1;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ALTER COLUMN "user_message_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ALTER COLUMN "assistant_message_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD CONSTRAINT "conversation_title_jobs_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "conversation_title_jobs" ADD CONSTRAINT "conversation_title_jobs_assistant_message_id_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
