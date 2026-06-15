import { describe, expect, test } from 'bun:test';

import { AdminService } from '../admin.service';

describe('admin service', () => {
  test('returns MVP overview', async () => {
    const service = new AdminService(
      {
        overview: async () => ({
          status: 'ok',
          dayPh: '2026-06-05',
          sections: ['usage', 'model-config', 'prompt-cache', 'telemetry']
        })
      } as never,
      { count: async () => 0 } as never,
      { count: async () => 0 } as never,
      { count: async () => 0 } as never,
      { count: async () => 0 } as never,
      { count: async () => 0 } as never
    );

    await expect(service.overview()).resolves.toMatchObject({
      status: 'ok',
      sections: ['usage', 'model-config', 'prompt-cache', 'telemetry']
    });
  });
});
