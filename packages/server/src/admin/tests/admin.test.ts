import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { AdminService } from '../admin.service';

describe('admin service', () => {
  test('returns MVP overview', async () => {
    const service = createContainer().get(AdminService);
    await expect(service.overview()).resolves.toMatchObject({
      status: 'ok',
      sections: ['usage', 'model-config', 'prompt-cache', 'telemetry']
    });
  });
});
