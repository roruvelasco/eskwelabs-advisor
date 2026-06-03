import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { telemetryDto } from '../dto/telemetry.dto';
import { TelemetryService } from '../telemetry.service';

describe('telemetry service', () => {
  test('lists placeholder events', async () => {
    const service = createContainer().get(TelemetryService);
    await expect(service.list()).resolves.toEqual([]);
  });
});

describe('telemetry dto', () => {
  test('accepts object payloads', () => {
    const result = telemetryDto.safeParse({
      eventName: 'test',
      payload: { key: 'value' }
    });
    expect(result.success).toBe(true);
  });

  test('rejects non-object payloads', () => {
    const result = telemetryDto.safeParse({
      eventName: 'test',
      payload: 'not-an-object'
    });
    expect(result.success).toBe(false);
  });
});
