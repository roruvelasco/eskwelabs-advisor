import { conversationDto, type ConversationDto } from './dto/conversations.dto';
import type { ConversationRow } from './conversations.repository';
import { paginatedResponse } from '../common/pagination';

function toDto(row: ConversationRow): ConversationDto {
  return conversationDto.parse(row);
}

export class ConversationsSerializer {
  list(result: { rows: ConversationRow[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map(toDto),
      result.rows.length,
      result.nextCursor
    );
  }

  single(row: ConversationRow) {
    return { data: toDto(row) };
  }
}
