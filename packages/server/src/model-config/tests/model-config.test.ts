import { describe, expect, test } from 'bun:test';

import { ModelConfigService } from '../model-config.service';

describe('model config service', () => {
  test('lists advisor model config from the repository', async () => {
    const service = new ModelConfigService({
      list: async () => [
        {
          advisorId: 'data-dashboard',
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
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
        model: 'gemini-2.5-flash-lite',
        isEnabled: true
      })
    ]);
  });

  test('updates enabled state with model configuration', async () => {
    const updates: unknown[] = [];
    const service = new ModelConfigService({
      upsert: async (advisorId: string, input: unknown) => {
        updates.push({ advisorId, input });
        return {
          advisorId,
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          isEnabled: false,
          updatedBy: 'admin-id',
          updatedAt: new Date()
        };
      }
    } as never);

    await expect(
      service.update('data-dashboard', {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        isEnabled: false,
        updatedBy: 'admin-id'
      })
    ).resolves.toMatchObject({
      advisorId: 'data-dashboard',
      isEnabled: false
    });
    expect(updates).toEqual([
      {
        advisorId: 'data-dashboard',
        input: {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          isEnabled: false,
          updatedBy: 'admin-id'
        }
      }
    ]);
  });
});
