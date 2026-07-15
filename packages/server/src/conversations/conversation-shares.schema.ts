import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

import { usersTable } from '../users/users.schema';
import { conversationsTable } from './conversations.schema';

export const conversationSharesTable = pgTable(
  'conversation_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareId: text('share_id').notNull(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => usersTable.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    shareIdUnique: uniqueIndex('conversation_shares_share_id_unique').on(
      table.shareId
    ),
    conversationUnique: uniqueIndex(
      'conversation_shares_conversation_unique'
    ).on(table.conversationId)
  })
);

export type ConversationShare = typeof conversationSharesTable.$inferSelect;
