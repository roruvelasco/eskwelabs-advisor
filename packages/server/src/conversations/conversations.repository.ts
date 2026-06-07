import { and, desc, eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { conversationsTable, type Conversation } from './conversations.schema';

export interface ConversationRow {
  id: string;
  userId: string;
  advisorId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function toRow(conversation: Conversation): ConversationRow {
  return {
    ...conversation,
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

  async create(input: { userId: string; advisorId: string; title: string }) {
    const rows = await this.drizzle.db
      .insert(conversationsTable)
      .values({
        userId: input.userId,
        advisorId: input.advisorId,
        title: input.title,
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
}
