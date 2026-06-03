import { ConversationsRepository } from './conversations.repository';
import { forbidden, notFound } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';

export class ConversationsService {
  constructor(private conversationsRepository: ConversationsRepository) {}

  async list(actor?: Actor, advisorId?: string) {
    if (!actor) return [];
    return this.conversationsRepository.listForUser(actor.id, advisorId);
  }

  async detail(actor: Actor, id: string) {
    const conversation = await this.conversationsRepository.findForUser(
      actor.id,
      id
    );
    if (!conversation) {
      throw notFound();
    }
    return conversation;
  }

  async create(actor: Actor, input: { advisorId: string; title?: string }) {
    return this.conversationsRepository.create({
      userId: actor.id,
      advisorId: input.advisorId,
      title: input.title ?? 'Untitled conversation'
    });
  }

  async assertOwns(actor: Actor, id: string) {
    const conversation = await this.conversationsRepository.findForUser(
      actor.id,
      id
    );
    if (!conversation) {
      throw forbidden();
    }
    return conversation;
  }
}
