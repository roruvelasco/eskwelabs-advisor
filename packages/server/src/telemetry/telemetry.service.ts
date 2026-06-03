import { TelemetryRepository } from './telemetry.repository';

export class TelemetryService {
  constructor(private telemetryRepository: TelemetryRepository) {}

  async list() {
    return this.telemetryRepository.list();
  }
}
