import { TelemetryRepository } from './telemetry.repository';
import type { PaginatedResult } from './telemetry.repository';
import type { TelemetrySeverity } from './telemetry.repository';
import type { TelemetryEvent } from './telemetry.schema';

export class TelemetryService {
  constructor(private telemetryRepository: TelemetryRepository) {}

  async list(
    eventName?: string,
    limit?: number,
    cursor?: string
  ): Promise<PaginatedResult<TelemetryEvent>> {
    return this.telemetryRepository.list({ eventName, limit, cursor });
  }

  async count() {
    return this.telemetryRepository.count();
  }

  async record(
    eventName: string,
    actorId?: string,
    severity: TelemetrySeverity = 'info',
    payload: Record<string, unknown> = {}
  ) {
    return this.telemetryRepository.insert({
      eventName,
      actorId,
      severity,
      payload
    });
  }
}
