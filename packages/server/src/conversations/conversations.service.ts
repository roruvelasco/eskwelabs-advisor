import { ConversationsRepository } from './conversations.repository';
import { AdvisorsService } from '../advisors/advisors.service';
import { AdvisorRuntimeService } from '../advisors/advisor-runtime.service';
import { forbidden, notFound } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';

const BLANK_TITLE_RE = /^\s*$/;

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

    const hasTitle =
      input.title !== undefined && !BLANK_TITLE_RE.test(input.title);

    return this.conversationsRepository.create({
      userId: actor.id,
      advisorId: input.advisorId,
      title: hasTitle ? input.title!.trim() : 'Untitled conversation',
      titleSource: hasTitle ? 'manual' : 'fallback',
      advisorRuntimeVersionId: runtime.runtimeVersionId
    });
  }

  async createImplicit(
    actor: Actor,
    input: {
      advisorId: string;
      fallbackTitle: string;
      runtimeVersionId: string;
    }
  ) {
    return this.conversationsRepository.create({
      userId: actor.id,
      advisorId: input.advisorId,
      title: input.fallbackTitle,
      titleSource: 'fallback',
      advisorRuntimeVersionId: input.runtimeVersionId
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

  async delete(actor: Actor, id: string) {
    const deleted = await this.conversationsRepository.deleteForUser(
      actor.id,
      id
    );
    if (!deleted) {
      throw notFound();
    }
  }

  async touch(id: string) {
    return this.conversationsRepository.touch(id);
  }
}
