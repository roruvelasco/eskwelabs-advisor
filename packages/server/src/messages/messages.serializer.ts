import { paginatedResponse } from '../common/pagination';

export class MessagesSerializer {
  list(result: { rows: unknown[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows,
      result.rows.length,
      result.nextCursor
    );
  }
}
