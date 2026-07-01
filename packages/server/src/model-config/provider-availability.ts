import type { ServerEnv } from '../config/env';

export function getAvailableProviderKeys(env: ServerEnv): string[] {
  const mode = env.LLM_PROVIDER_MODE;

  if (mode === 'deterministic') {
    return ['deterministic'];
  }

  if (mode !== 'auto') {
    switch (mode) {
      case 'gemini':
        return env.GEMINI_API_KEY ? ['gemini'] : [];
      case 'groq':
        return env.GROQ_API_KEY ? ['groq'] : [];
      case 'openrouter':
        return env.OPENROUTER_API_KEY ? ['openrouter'] : [];
      default:
        return [];
    }
  }

  const available: string[] = [];

  if (env.GROQ_API_KEY) available.push('groq');
  if (env.GEMINI_API_KEY) available.push('gemini');
  if (env.OPENROUTER_API_KEY) available.push('openrouter');

  if (available.length === 0) {
    if (env.RUNTIME_PROFILE !== 'production') {
      available.push('deterministic');
    }
  }

  return available;
}
