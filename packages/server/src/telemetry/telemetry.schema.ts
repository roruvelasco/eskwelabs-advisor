import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const telemetryEventsTable = pgTable(
  'telemetry_events',
  {
    id: uuid('id').notNull().defaultRandom(),
    eventName: text('event_name').notNull(),
    actorId: text('actor_id'),
    severity: text('severity').notNull().default('info'),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
    severityCheck: check(
      'telemetry_events_severity_check',
      sql`${table.severity} in ('info', 'warning', 'error')`
    ),
    createdDescIdx: index('telemetry_events_created_desc_idx').on(
      table.createdAt.desc(),
      table.id.desc()
    ),
    eventCreatedIdx: index('telemetry_events_event_created_idx').on(
      table.eventName,
      table.createdAt.desc(),
      table.id.desc()
    )
  })
);

export type TelemetryEvent = typeof telemetryEventsTable.$inferSelect;
