import type { Actor } from '../../common/utils/hono';
import type { MessagesService } from '../messages.service';

export type ChatTurnInput = {
  conversationId?: string;
  advisorId?: string;
  content: string;
  clientTurnId?: string;
};

export class ChatTurnUseCase {
  constructor(private messagesService: MessagesService) {}

  async execute(actor: Actor, input: ChatTurnInput) {
    return this.messagesService.chatTurn(actor, input);
  }
}

export class StreamChatTurnUseCase {
  constructor(private messagesService: MessagesService) {}

  execute(actor: Actor, input: ChatTurnInput) {
    return this.messagesService.streamChatTurn(actor, input);
  }
}
