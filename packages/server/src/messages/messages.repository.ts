import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import type { DbTransaction } from '../db/drizzle.service';
import {
  conversationsTable,
  type ConversationTitleSource
} from '../conversations/conversations.schema';
import { messagesTable, type Message } from './messages.schema';

export interface MessageRow {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: string;
  latencyMs?: number;
  status: 'ok' | 'blocked' | 'error' | 'pending' | 'streaming';
  blockReason?: string;
  promptDocRevision?: string;
  dnaDigestVersion?: string;
  clientTurnId?: string;
  createdAt: string;
}

export type MessageCreateInput = Omit<MessageRow, 'id' | 'createdAt'>;

function nullable<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

function toRow(message: Message): MessageRow {
  return {
    id: message.id,
    conversationId: message.conversationId,
    userId: message.userId,
    role: message.role as MessageRow['role'],
    content: message.content,
    provider: nullable(message.provider),
    model: nullable(message.model),
    promptTokens: nullable(message.promptTokens),
    completionTokens: nullable(message.completionTokens),
    estimatedCostUsd: nullable(message.estimatedCostUsd),
    latencyMs: nullable(message.latencyMs),
    status: message.status as MessageRow['status'],
    blockReason: nullable(message.blockReason),
    promptDocRevision: nullable(message.promptDocRevision),
    dnaDigestVersion: nullable(message.dnaDigestVersion),
    clientTurnId: nullable(message.clientTurnId),
    createdAt: message.createdAt.toISOString()
  };
}

export class MessagesRepository extends Repository {
  async listForConversation(conversationId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt), desc(messagesTable.role));

    return rows.map(toRow);
  }

  async create(input: MessageCreateInput) {
    const rows = await this.drizzle.db
      .insert(messagesTable)
      .values(input)
      .returning();

    return toRow(rows[0]);
  }

  async createConversation(input: {
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
        advisorRuntimeVersionId: input.advisorRuntimeVersionId ?? null,
        status: 'active'
      })
      .returning();

    return {
      id: rows[0].id,
      advisorId: rows[0].advisorId,
      advisorRuntimeVersionId: rows[0].advisorRuntimeVersionId
    };
  }

  async createConversationWithTurn(
    userId: string,
    conversationInput: {
      advisorId: string;
      title: string;
      titleSource: ConversationTitleSource;
      advisorRuntimeVersionId?: string;
    },
    userMessage: MessageCreateInput,
    assistantMessage: MessageCreateInput
  ) {
    return this.drizzle.db.transaction(async (tx) => {
      const convoRows = await tx
        .insert(conversationsTable)
        .values({
          userId,
          advisorId: conversationInput.advisorId,
          advisorRuntimeVersionId: conversationInput.advisorRuntimeVersionId,
          title: conversationInput.title,
          titleSource: conversationInput.titleSource,
          status: 'active'
        })
        .returning();

      const conversation = convoRows[0];

      const userRows = await tx
        .insert(messagesTable)
        .values({
          ...userMessage,
          conversationId: conversation.id
        })
        .returning();

      const assistantRows = await tx
        .insert(messagesTable)
        .values({
          ...assistantMessage,
          conversationId: conversation.id
        })
        .returning();

      return {
        conversation: {
          id: conversation.id,
          advisorId: conversation.advisorId,
          advisorRuntimeVersionId:
            conversation.advisorRuntimeVersionId ?? undefined
        },
        userMessage: toRow(userRows[0]),
        assistantMessage: toRow(assistantRows[0])
      };
    });
  }

  async findSuccessfulExchangeByIds(input: {
    conversationId: string;
    userMessageId: string;
    assistantMessageId: string;
  }): Promise<{
    userMessage: MessageRow;
    assistantMessage: MessageRow;
  } | null> {
    const rows = await this.drizzle.db
      .select()
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.conversationId, input.conversationId),
          inArray(messagesTable.id, [
            input.userMessageId,
            input.assistantMessageId
          ])
        )
      )
      .limit(2);

    if (rows.length !== 2) return null;

    const userMsg = rows.find(
      (r) =>
        r.id === input.userMessageId && r.role === 'user' && r.status === 'ok'
    );
    const assistantMsg = rows.find(
      (r) =>
        r.id === input.assistantMessageId &&
        r.role === 'assistant' &&
        r.status === 'ok'
    );

    if (!userMsg || !assistantMsg) return null;

    return {
      userMessage: toRow(userMsg),
      assistantMessage: toRow(assistantMsg)
    };
  }

  async createSuccessfulTurn(
    userMessage: MessageCreateInput,
    assistantMessage: MessageCreateInput
  ) {
    return this.drizzle.db.transaction((tx) =>
      this.createSuccessfulTurnInTransaction(tx, userMessage, assistantMessage)
    );
  }

  async createSuccessfulTurnInTransaction(
    tx: DbTransaction,
    userMessage: MessageCreateInput,
    assistantMessage: MessageCreateInput
  ) {
    const userRows = await tx
      .insert(messagesTable)
      .values(userMessage)
      .returning();
    const assistantRows = await tx
      .insert(messagesTable)
      .values(assistantMessage)
      .returning();

    return {
      userMessage: toRow(userRows[0]),
      assistantMessage: toRow(assistantRows[0])
    };
  }

  async createErroredTurn(
    userMessage: MessageCreateInput,
    assistantMessage: MessageCreateInput
  ) {
    return this.drizzle.db.transaction(async (tx) => {
      const userRows = await tx
        .insert(messagesTable)
        .values(userMessage)
        .returning();
      const assistantRows = await tx
        .insert(messagesTable)
        .values(assistantMessage)
        .returning();

      return {
        userMessage: toRow(userRows[0]),
        assistantMessage: toRow(assistantRows[0])
      };
    });
  }
}
