ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" in ('eif', 'admin'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" in ('active'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_title_source_check" CHECK ("conversations"."title_source" in ('legacy', 'fallback', 'generated', 'manual'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('user', 'assistant'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_status_check" CHECK ("messages"."status" in ('ok', 'blocked', 'error', 'pending', 'streaming'));--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_severity_check" CHECK ("telemetry_events"."severity" in ('info', 'warning', 'error'));