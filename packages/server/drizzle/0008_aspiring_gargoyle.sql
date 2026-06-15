CREATE INDEX "users_created_desc_idx" ON "users" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "advisor_runtime_versions_advisor_status_version_idx" ON "advisor_runtime_versions" USING btree ("advisor_id","status","version_number" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_user_advisor_updated_idx" ON "conversations" USING btree ("user_id","advisor_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_convo_created_asc_idx" ON "messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "messages_convo_created_desc_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "prompt_cache_updated_key_idx" ON "prompt_cache" USING btree ("updated_at" DESC NULLS LAST,"key");--> statement-breakpoint
CREATE INDEX "usage_counters_day_ph_user_idx" ON "usage_counters" USING btree ("day_ph" DESC NULLS LAST,"user_id");--> statement-breakpoint
CREATE INDEX "telemetry_events_created_desc_idx" ON "telemetry_events" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "telemetry_events_event_created_idx" ON "telemetry_events" USING btree ("event_name","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);