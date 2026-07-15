import { AdvisorsService } from '../advisors/advisors.service';
import { forbidden, notFound } from '../common/http/http-exception';
import type { Actor } from '../common/utils/hono';
import { ConversationSharesRepository } from './conversation-shares.repository';
import { ConversationsRepository } from './conversations.repository';
import type { SharedConversationViewDto } from './dto/conversation-shares.dto';

function generateShareId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64url');
}

export class ConversationSharesService {
  constructor(
    private conversationSharesRepository: ConversationSharesRepository,
    private conversationsRepository: ConversationsRepository,
    private advisorsService: AdvisorsService
  ) {}

  async share(actor: Actor, conversationId: string) {
    const conversation = await this.conversationsRepository.findForUser(
      actor.id,
      conversationId
    );
    if (!conversation) {
      throw forbidden();
    }

    const existing =
      await this.conversationSharesRepository.findByConversationId(
        conversationId
      );
    if (existing) {
      return existing.isActive
        ? existing
        : this.conversationSharesRepository.reactivate(existing.id);
    }

    return this.conversationSharesRepository.create({
      shareId: generateShareId(),
      conversationId,
      createdBy: actor.id
    });
  }

  async sharedView(shareId: string): Promise<SharedConversationViewDto> {
    const share =
      await this.conversationSharesRepository.findActiveByShareId(shareId);
    if (!share) {
      throw notFound();
    }

    const conversation =
      await this.conversationSharesRepository.findActiveConversation(
        share.conversationId
      );
    if (!conversation) {
      throw notFound();
    }

    const [advisor, messages] = await Promise.all([
      this.advisorsService.findById(conversation.advisorId),
      this.conversationSharesRepository.listSharedMessages(share.conversationId)
    ]);

    return {
      conversation: {
        title: conversation.title,
        advisorName: advisor?.name ?? 'Advisor',
        createdAt: conversation.createdAt
      },
      messages
    };
  }
}
