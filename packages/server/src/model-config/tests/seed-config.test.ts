import { describe, expect, test } from 'bun:test';
import { ModelConfigRepository } from '../model-config.repository';

describe('ModelConfig upsert behavior', () => {
  test('Admin model config accepts provider = groq and model = llama-3.3-70b-versatile', async () => {
    let capturedInsert: Record<string, unknown> | null = null;
    const dbMock = {
      db: {
        insert: () => ({
          values: (v: Record<string, unknown>) => ({
            onConflictDoUpdate: (u: { set: Record<string, unknown> }) => ({
              returning: async () => {
                capturedInsert = { ...v, _updateInfo: u.set };
                return [v];
              }
            })
          })
        })
      }
    };

    const repo = new ModelConfigRepository(dbMock as never);
    await repo.upsert('data-dashboard', {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      updatedBy: 'admin',
      isEnabled: true
    });

    expect(capturedInsert).toMatchObject({
      advisorId: 'data-dashboard',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      updatedBy: 'admin',
      isEnabled: true
    });

    expect(capturedInsert!._updateInfo).toMatchObject({
      provider: 'groq',
      model: 'llama-3.3-70b-versatile'
    });
  });
});
