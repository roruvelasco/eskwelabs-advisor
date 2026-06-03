import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { ModelConfigService } from '../model-config.service';

describe('model config service', () => {
  test('lists seeded advisor model config', async () => {
    const service = createContainer().get(ModelConfigService);
    await expect(service.list()).resolves.toHaveLength(3);
  });
});
