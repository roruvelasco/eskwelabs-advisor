CREATE SEQUENCE IF NOT EXISTS "messages_seq_seq";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "seq" bigint;--> statement-breakpoint
UPDATE "messages" SET "seq" = sub.rn FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn FROM "messages") sub WHERE "messages".id = sub.id;--> statement-breakpoint
SELECT setval('messages_seq_seq', COALESCE((SELECT MAX(seq) FROM "messages"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "seq" SET DEFAULT nextval('messages_seq_seq');--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_convo_seq_asc_idx" ON "messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE INDEX "messages_convo_seq_desc_idx" ON "messages" USING btree ("conversation_id","seq" DESC NULLS LAST);
