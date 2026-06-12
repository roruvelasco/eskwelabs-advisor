import { conversationDto, type ConversationDto } from './dto/conversations.dto';
import type { ConversationRow } from './conversations.repository';

function toDto(row: ConversationRow): ConversationDto {
  return conversationDto.parse(row);
}

export class ConversationsSerializer {
  list(rows: ConversationRow[]) {
    return { data: rows.map(toDto) };
  }

  single(row: ConversationRow) {
    return { data: toDto(row) };
  }
}
