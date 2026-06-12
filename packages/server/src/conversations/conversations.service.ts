import { ConversationsRepository } from './conversations.repository';
import { AdvisorsService } from '../advisors/advisors.service';
import { AdvisorRuntimeService } from '../advisors/advisor-runtime.service';
import { forbidden, notFound } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';

export class ConversationsService {
  constructor(
    private conversationsRepository: ConversationsRepository,
    private advisorRuntimeService: AdvisorRuntimeService,
    private advisorsService: AdvisorsService
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
    const runtime = await this.advisorRuntimeService.resolveRunnableVersion(
      input.advisorId
    );

    return this.conversationsRepository.create({
      userId: actor.id,
      advisorId: input.advisorId,
      title: input.title ?? 'Untitled conversation',
      advisorRuntimeVersionId: runtime.runtimeVersionId
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
