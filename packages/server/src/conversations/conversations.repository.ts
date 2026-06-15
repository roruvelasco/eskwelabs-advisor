import { and, desc, eq, lt, or } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, encodeCursor } from '../common/pagination';
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

export interface PaginatedResult<T> {
  rows: T[];
  nextCursor: string | null;
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
  async listForUser(
    userId: string,
    {
      advisorId,
      limit = 50,
      cursor
    }: {
      advisorId?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<PaginatedResult<ConversationRow>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(
            conversationsTable.updatedAt,
            new Date(decoded.updatedAt as string)
          ),
          and(
            eq(
              conversationsTable.updatedAt,
              new Date(decoded.updatedAt as string)
            ),
            lt(conversationsTable.id, decoded.id as string)
          )
        )
      : undefined;

    const whereConditions = [
      eq(conversationsTable.userId, userId),
      ...(advisorId ? [eq(conversationsTable.advisorId, advisorId)] : []),
      ...(cursorConditions ? [cursorConditions] : [])
    ];

    const rows = await this.drizzle.db
      .select()
      .from(conversationsTable)
      .where(and(...whereConditions))
      .orderBy(desc(conversationsTable.updatedAt), desc(conversationsTable.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
      ? encodeCursor({
          updatedAt: resultRows[resultRows.length - 1].updatedAt.toISOString(),
          id: resultRows[resultRows.length - 1].id
        })
      : null;

    return { rows: resultRows.map(toRow), nextCursor };
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
