import { ConversationsRepository } from './conversations.repository';
import { AdvisorsService } from '../advisors/advisors.service';
import {
  forbidden,
  HttpException,
  notFound
} from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';
import { ModelConfigService } from '../model-config/model-config.service';

export class ConversationsService {
  constructor(
    private conversationsRepository: ConversationsRepository,
    private advisorsService: AdvisorsService,
    private modelConfigService: ModelConfigService
  ) {}

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
    const advisor = await this.advisorsService.getActive(input.advisorId);
    const config = await this.modelConfigService.getForAdvisor(input.advisorId);

    if (!advisor.promptDocId || config?.isEnabled === false) {
      throw new HttpException(
        422,
        'Advisor is not ready for chat',
        'advisor_not_configured'
      );
    }

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

  async touch(id: string) {
    return this.conversationsRepository.touch(id);
  }
}
