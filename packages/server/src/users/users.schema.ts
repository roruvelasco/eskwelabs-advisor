import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ActorRole } from '../common/utils/hono';

export const usersTable = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('eif').$type<ActorRole>(),
  isActive: boolean('is_active').notNull().default(true),
  consentAcknowledgedAt: timestamp('consent_acknowledged_at', {
    withTimezone: true
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type User = typeof usersTable.$inferSelect;
