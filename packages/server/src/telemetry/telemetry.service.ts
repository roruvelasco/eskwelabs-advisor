import { TelemetryRepository } from './telemetry.repository';
import type { TelemetrySeverity } from './telemetry.repository';

export class TelemetryService {
  constructor(private telemetryRepository: TelemetryRepository) {}

  async list() {
    return this.telemetryRepository.list();
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
