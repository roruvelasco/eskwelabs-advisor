import { describe, expect, test } from 'bun:test';

import { ModelCatalogService } from '../model-catalog.service';
import type { ServerEnv } from '../../config/env';

function makeEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    LLM_PROVIDER_MODE: 'auto',
    GROQ_API_KEY: '',
    GEMINI_API_KEY: '',
    OPENROUTER_API_KEY: '',
    RUNTIME_PROFILE: 'production',
    ...overrides
  } as ServerEnv;
}

describe('ModelCatalogService', () => {
  test('returns only groq models when only groq key is set', () => {
    const service = new ModelCatalogService(
      makeEnv({ GROQ_API_KEY: 'gsk_test' })
    );
    const catalog = service.getCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.provider).toBe('groq');
    expect(catalog[0]!.label).toBe('Groq');
    expect(catalog[0]!.models).toHaveLength(2);
    expect(catalog[0]!.models.map((m) => m.model)).toContain(
      'llama-3.3-70b-versatile'
    );
    expect(catalog[0]!.models.map((m) => m.model)).toContain(
      'llama-3.1-8b-instant'
    );
  });

  test('returns multiple providers when multiple keys are set', () => {
    const service = new ModelCatalogService(
      makeEnv({
        GROQ_API_KEY: 'gsk_test',
        GEMINI_API_KEY: 'gemini_key'
      })
    );
    const catalog = service.getCatalog();

    expect(catalog).toHaveLength(2);
    expect(catalog.map((p) => p.provider)).toEqual(['groq', 'gemini']);
  });

  test('returns empty array when no providers are available', () => {
    const service = new ModelCatalogService(makeEnv());
    expect(service.getCatalog()).toEqual([]);
  });

  test('each model has pricing fields', () => {
    const service = new ModelCatalogService(
      makeEnv({ GEMINI_API_KEY: 'gemini_key' })
    );
    const catalog = service.getCatalog();

    expect(catalog).toHaveLength(1);
    for (const model of catalog[0]!.models) {
      expect(typeof model.inputUsdPerMillionTokens).toBe('number');
      expect(typeof model.outputUsdPerMillionTokens).toBe('number');
      expect(model.inputUsdPerMillionTokens).toBeGreaterThanOrEqual(0);
    }
  });

  test('returns deterministic when in deterministic mode', () => {
    const service = new ModelCatalogService(
      makeEnv({
        LLM_PROVIDER_MODE: 'deterministic',
        GROQ_API_KEY: 'gsk_test',
        GEMINI_API_KEY: 'gemini_key'
      })
    );
    const catalog = service.getCatalog();

    expect(catalog).toHaveLength(1);
    expect(catalog[0]!.provider).toBe('deterministic');
    expect(catalog[0]!.label).toBe('Deterministic');
    expect(catalog[0]!.models).toHaveLength(1);
    expect(catalog[0]!.models[0]!.model).toBe('deterministic-model');
  });
});
