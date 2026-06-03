import { Repository } from '../common/factories/repository.factory';

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

const messages: MessageRow[] = [];

export class MessagesRepository extends Repository {
  async listForConversation(conversationId: string) {
    return messages.filter(
      (message) => message.conversationId === conversationId
    );
  }

  async create(input: Omit<MessageRow, 'id' | 'createdAt'>) {
    const row: MessageRow = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...input
    };
    messages.push(row);
    return row;
  }
}
