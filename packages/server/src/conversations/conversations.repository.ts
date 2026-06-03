import { Repository } from '../common/factories/repository.factory';

interface ConversationRow {
  id: string;
  userId: string;
  advisorId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const conversations = new Map<string, ConversationRow>();

export class ConversationsRepository extends Repository {
  async listForUser(userId: string, advisorId?: string) {
    return [...conversations.values()].filter(
      (conversation) =>
        conversation.userId === userId &&
        (!advisorId || conversation.advisorId === advisorId)
    );
  }

  async findForUser(userId: string, id: string) {
    const conversation = conversations.get(id);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }
    return conversation;
  }

  async create(input: { userId: string; advisorId: string; title: string }) {
    const now = new Date().toISOString();
    const row: ConversationRow = {
      id: crypto.randomUUID(),
      userId: input.userId,
      advisorId: input.advisorId,
      title: input.title,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    conversations.set(row.id, row);
    return row;
  }
}
