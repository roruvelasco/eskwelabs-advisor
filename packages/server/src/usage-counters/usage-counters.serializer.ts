import { paginatedResponse } from '../common/pagination';
import { usageCounterDto } from './dto/usage-counters.dto';
import type { UsageCounterRow } from './usage-counters.repository';

export class UsageCountersSerializer {
  private serialize(row: UsageCounterRow) {
    return {
      ...usageCounterDto.parse(row),
      userEmail: row.userEmail ?? undefined
    };
  }

  list(result: { rows: UsageCounterRow[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((row) => this.serialize(row)),
      result.rows.length,
      result.nextCursor
    );
  }
}
