import { and, desc, eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import {
  conversationsTable,
  type ConversationTitleSource,
  type Conversation
} from './conversations.schema';

export interface ConversationRow {
  id: string;
  userId: string;
  advisorId: string;
  advisorRuntimeVersionId?: string | null;
  title: string;
  titleSource: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function toRow(conversation: Conversation): ConversationRow {
  return {
    ...conversation,
    advisorRuntimeVersionId: conversation.advisorRuntimeVersionId ?? undefined,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString()
  };
}

export class ConversationsRepository extends Repository {
  async listForUser(userId: string, advisorId?: string) {
    const rows = await this.drizzle.db
      .select()
      .from(conversationsTable)
      .where(
        advisorId
          ? and(
              eq(conversationsTable.userId, userId),
              eq(conversationsTable.advisorId, advisorId)
            )
          : eq(conversationsTable.userId, userId)
      )
      .orderBy(desc(conversationsTable.updatedAt));

    return rows.map(toRow);
  }

  async findForUser(userId: string, id: string) {
    const rows = await this.drizzle.db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, id),
          eq(conversationsTable.userId, userId)
        )
      )
      .limit(1);

    return rows[0] ? toRow(rows[0]) : null;
  }

  async create(input: {
    userId: string;
    advisorId: string;
    title: string;
    titleSource: ConversationTitleSource;
    advisorRuntimeVersionId?: string | null;
  }) {
    const rows = await this.drizzle.db
      .insert(conversationsTable)
      .values({
        userId: input.userId,
        advisorId: input.advisorId,
        title: input.title,
        titleSource: input.titleSource,
        advisorRuntimeVersionId: input.advisorRuntimeVersionId,
        status: 'active'
      })
      .returning();

    return toRow(rows[0]);
  }

  async touch(id: string) {
    await this.drizzle.db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, id));
  }

  async updateGeneratedTitleIfFallback(
    conversationId: string,
    title: string
  ): Promise<boolean> {
    const result = await this.drizzle.db
      .update(conversationsTable)
      .set({ title, titleSource: 'generated' })
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.titleSource, 'fallback')
        )
      )
      .returning({ id: conversationsTable.id });

    return result.length > 0;
  }

  async deleteForUser(userId: string, conversationId: string) {
    const deleted = await this.drizzle.db
      .delete(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.userId, userId)
        )
      )
      .returning({ id: conversationsTable.id });

    return deleted.length > 0;
  }
}
