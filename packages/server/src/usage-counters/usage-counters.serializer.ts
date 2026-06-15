import { paginatedResponse } from '../common/pagination';

export class UsageCountersSerializer {
  list(result: { rows: unknown[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows,
      result.rows.length,
      result.nextCursor
    );
  }
}
