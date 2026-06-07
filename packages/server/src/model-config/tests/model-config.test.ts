import { describe, expect, test } from 'bun:test';

import { ModelConfigService } from '../model-config.service';

describe('model config service', () => {
  test('lists advisor model config from the repository', async () => {
    const service = new ModelConfigService({
      list: async () => [
        {
          advisorId: 'data-dashboard',
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          isEnabled: true,
          updatedBy: null,
          updatedAt: new Date()
        }
      ]
    } as never);

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        advisorId: 'data-dashboard',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        isEnabled: true
      })
    ]);
  });
});
