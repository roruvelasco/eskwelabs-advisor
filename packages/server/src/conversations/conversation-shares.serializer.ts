import { dataResponse } from '../common/pagination';
import type { ConversationShareRow } from './conversation-shares.repository';
import {
  conversationShareLinkDto,
  sharedConversationViewDto,
  type SharedConversationViewDto
} from './dto/conversation-shares.dto';

export class ConversationSharesSerializer {
  link(row: ConversationShareRow, origin: string) {
    return dataResponse(
      conversationShareLinkDto.parse({
        shareId: row.shareId,
        url: `${origin}/share/${row.shareId}`
      })
    );
  }

  sharedView(view: SharedConversationViewDto) {
    return dataResponse(sharedConversationViewDto.parse(view));
  }
}
