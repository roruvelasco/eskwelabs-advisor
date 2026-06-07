import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const telemetryEventsTable = pgTable('telemetry_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: text('event_name').notNull(),
  actorId: uuid('actor_id'),
  severity: text('severity').notNull().default('info'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type TelemetryEvent = typeof telemetryEventsTable.$inferSelect;
