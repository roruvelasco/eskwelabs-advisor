import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { TelemetryService } from '../telemetry.service';

describe('telemetry service', () => {
  test('lists placeholder events', async () => {
    const service = createContainer().get(TelemetryService);
    await expect(service.list()).resolves.toEqual([]);
  });
});
