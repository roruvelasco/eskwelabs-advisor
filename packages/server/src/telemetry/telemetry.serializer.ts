import { paginatedResponse } from '../common/pagination';
import { telemetryEventDto } from './dto/telemetry.dto';
import type { TelemetryEvent } from './telemetry.schema';

export class TelemetrySerializer {
  list(result: { rows: TelemetryEvent[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((row) => telemetryEventDto.parse(row)),
      result.rows.length,
      result.nextCursor
    );
  }
}
