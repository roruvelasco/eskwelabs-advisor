import { paginatedResponse } from '../common/pagination';
import { usageCounterDto } from './dto/usage-counters.dto';
import type {
  UsageCounterRow,
  UsageSummaryDay,
  UsageSummaryTopUser
} from './usage-counters.repository';

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

  summary(result: {
    range: { fromDayPh: string; toDayPh: string; timeZone: 'Asia/Manila' };
    totals: {
      messages: number;
      tokens: number;
      estimatedSpendUsd: string;
      activeUsers: number;
    };
    days: UsageSummaryDay[];
    topUsers: UsageSummaryTopUser[];
  }) {
    return {
      data: {
        ...result,
        topUsers: result.topUsers.map((row) => ({
          ...row,
          userEmail: row.userEmail ?? undefined
        }))
      }
    };
  }
}
