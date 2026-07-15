import { and, asc, eq, isNull } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { messagesTable } from '../messages/messages.schema';
import {
  conversationSharesTable,
  type ConversationShare
} from './conversation-shares.schema';
import { conversationsTable } from './conversations.schema';

export interface ConversationShareRow {
  id: string;
  shareId: string;
  conversationId: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedMessageRow {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const SHARED_MESSAGES_MAX = 500;

function toRow(share: ConversationShare): ConversationShareRow {
  return {
    ...share,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString()
  };
}

export class ConversationSharesRepository extends Repository {
  async findByConversationId(conversationId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(conversationSharesTable)
      .where(eq(conversationSharesTable.conversationId, conversationId))
      .limit(1);

    return rows[0] ? toRow(rows[0]) : null;
  }

  async findActiveByShareId(shareId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(conversationSharesTable)
      .where(
        and(
          eq(conversationSharesTable.shareId, shareId),
          eq(conversationSharesTable.isActive, true)
        )
      )
      .limit(1);

    return rows[0] ? toRow(rows[0]) : null;
  }

  async create(input: {
    shareId: string;
    conversationId: string;
    createdBy: string;
  }): Promise<ConversationShareRow> {
    const rows = await this.drizzle.db
      .insert(conversationSharesTable)
      .values(input)
      .onConflictDoNothing({ target: conversationSharesTable.conversationId })
      .returning();

    if (rows[0]) return toRow(rows[0]);

    const existing = await this.findByConversationId(input.conversationId);
    if (!existing) {
      throw new Error('Failed to create conversation share');
    }
    return existing;
  }

  async reactivate(id: string): Promise<ConversationShareRow> {
    const rows = await this.drizzle.db
      .update(conversationSharesTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(conversationSharesTable.id, id))
      .returning();

    return toRow(rows[0]);
  }

  async findActiveConversation(conversationId: string) {
    const rows = await this.drizzle.db
      .select({
        title: conversationsTable.title,
        advisorId: conversationsTable.advisorId,
        createdAt: conversationsTable.createdAt
      })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          isNull(conversationsTable.deletedAt)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      title: row.title,
      advisorId: row.advisorId,
      createdAt: row.createdAt.toISOString()
    };
  }

  async listSharedMessages(
    conversationId: string
  ): Promise<SharedMessageRow[]> {
    const rows = await this.drizzle.db
      .select({
        role: messagesTable.role,
        content: messagesTable.content,
        createdAt: messagesTable.createdAt
      })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, conversationId),
          eq(messagesTable.status, 'ok')
        )
      )
      .orderBy(asc(messagesTable.seq))
      .limit(SHARED_MESSAGES_MAX);

    return rows.map((row) => ({
      role: row.role as SharedMessageRow['role'],
      content: row.content,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
