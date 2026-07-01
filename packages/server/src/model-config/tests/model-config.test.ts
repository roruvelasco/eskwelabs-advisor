import { describe, expect, test } from 'bun:test';

import { ModelConfigService } from '../model-config.service';
import type { ServerEnv } from '../../config/env';

const mockEnv = {
  LLM_PROVIDER_MODE: 'auto',
  GROQ_API_KEY: 'gsk_test',
  GEMINI_API_KEY: '',
  OPENROUTER_API_KEY: '',
  RUNTIME_PROFILE: 'test'
} as ServerEnv;

describe('model config service', () => {
  test('lists advisor model config from the repository', async () => {
    const service = new ModelConfigService(
      {
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
      } as never,
      mockEnv
    );

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        advisorId: 'data-dashboard',
        provider: 'gemini',
        model: 'gemini-2.5-flash-lite',
        isEnabled: true
      })
    ]);
  });

  test('rejects unavailable provider with 422', async () => {
    const service = new ModelConfigService(
      {
        upsert: async () => {
          throw new Error('upsert should not be called');
        }
      } as never,
      mockEnv
    );

    const err = await service
      .update('data-dashboard', {
        provider: 'openai',
        model: 'gpt-4',
        updatedBy: 'admin-id'
      })
      .catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Record<string, unknown>).status).toBe(422);
    expect((err as Record<string, unknown>).code).toBe('model_not_available');
  });

  test('rejects available provider but unavailable model with 422', async () => {
    const service = new ModelConfigService(
      {
        upsert: async () => {
          throw new Error('upsert should not be called');
        }
      } as never,
      mockEnv
    );

    const err = await service
      .update('data-dashboard', {
        provider: 'groq',
        model: 'nonexistent-model',
        updatedBy: 'admin-id'
      })
      .catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Record<string, unknown>).status).toBe(422);
    expect((err as Record<string, unknown>).code).toBe('model_not_available');
  });

  test('updates enabled state with model configuration', async () => {
    const updates: unknown[] = [];
    const service = new ModelConfigService(
      {
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
      } as never,
      mockEnv
    );

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
