import { asc, eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
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
  status: 'ok' | 'blocked' | 'error';
  blockReason?: string;
  promptDocRevision?: string;
  dnaDigestVersion?: string;
  createdAt: string;
}

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
    createdAt: message.createdAt.toISOString()
  };
}

export class MessagesRepository extends Repository {
  async listForConversation(conversationId: string) {
    const rows = await this.drizzle.db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(asc(messagesTable.createdAt));

    return rows.map(toRow);
  }

  async create(input: Omit<MessageRow, 'id' | 'createdAt'>) {
    const rows = await this.drizzle.db
      .insert(messagesTable)
      .values(input)
      .returning();

    return toRow(rows[0]);
  }
}
