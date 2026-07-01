import { describe, expect, test } from 'bun:test';

import { getAvailableProviderKeys } from '../provider-availability';
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

describe('getAvailableProviderKeys', () => {
  describe('deterministic mode', () => {
    test('returns deterministic regardless of API keys', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'deterministic',
            GROQ_API_KEY: 'gsk_test',
            GEMINI_API_KEY: 'gemini_key',
            OPENROUTER_API_KEY: 'or_key'
          })
        )
      ).toEqual(['deterministic']);
    });
  });

  describe('gemini mode', () => {
    test('returns gemini when API key is set', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({ LLM_PROVIDER_MODE: 'gemini', GEMINI_API_KEY: 'key' })
        )
      ).toEqual(['gemini']);
    });

    test('returns empty when API key is missing', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({ LLM_PROVIDER_MODE: 'gemini', GEMINI_API_KEY: '' })
        )
      ).toEqual([]);
    });
  });

  describe('groq mode', () => {
    test('returns groq when API key is set', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({ LLM_PROVIDER_MODE: 'groq', GROQ_API_KEY: 'gsk_test' })
        )
      ).toEqual(['groq']);
    });

    test('returns empty when API key is missing', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({ LLM_PROVIDER_MODE: 'groq', GROQ_API_KEY: '' })
        )
      ).toEqual([]);
    });
  });

  describe('openrouter mode', () => {
    test('returns openrouter when API key is set', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'openrouter',
            OPENROUTER_API_KEY: 'sk-or-v1-xxx'
          })
        )
      ).toEqual(['openrouter']);
    });

    test('returns empty when API key is missing', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({ LLM_PROVIDER_MODE: 'openrouter', OPENROUTER_API_KEY: '' })
        )
      ).toEqual([]);
    });
  });

  describe('auto mode', () => {
    test('returns all providers with configured API keys', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'auto',
            GROQ_API_KEY: 'gsk_test',
            GEMINI_API_KEY: 'gemini_key',
            OPENROUTER_API_KEY: 'or_key'
          })
        )
      ).toEqual(['groq', 'gemini', 'openrouter']);
    });

    test('returns only providers with keys present', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'auto',
            GROQ_API_KEY: 'gsk_test',
            GEMINI_API_KEY: '',
            OPENROUTER_API_KEY: ''
          })
        )
      ).toEqual(['groq']);
    });

    test('falls back to deterministic when no providers have keys and not production', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'auto',
            RUNTIME_PROFILE: 'demo',
            GROQ_API_KEY: '',
            GEMINI_API_KEY: '',
            OPENROUTER_API_KEY: ''
          })
        )
      ).toEqual(['deterministic']);
    });

    test('returns empty when no providers have keys in production', () => {
      expect(
        getAvailableProviderKeys(
          makeEnv({
            LLM_PROVIDER_MODE: 'auto',
            RUNTIME_PROFILE: 'production',
            GROQ_API_KEY: '',
            GEMINI_API_KEY: '',
            OPENROUTER_API_KEY: ''
          })
        )
      ).toEqual([]);
    });
  });
});
