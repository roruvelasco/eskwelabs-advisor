import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ActorRole } from '../common/utils/hono';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('eif').$type<ActorRole>(),
    isActive: boolean('is_active').notNull().default(true),
    consentAcknowledgedAt: timestamp('consent_acknowledged_at', {
      withTimezone: true
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    roleCheck: check(
      'users_role_check',
      sql`${table.role} in ('eif', 'admin')`
    ),
    createdDescIdx: index('users_created_desc_idx').on(
      table.createdAt.desc(),
      table.id.desc()
    )
  })
);

export type User = typeof usersTable.$inferSelect;
