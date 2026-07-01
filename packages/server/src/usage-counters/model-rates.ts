export type ModelRate = {
  provider: string;
  model: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

export const MODEL_RATES: ModelRate[] = [
  {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.4
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash-lite',
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.4
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    inputUsdPerMillionTokens: 0.3,
    outputUsdPerMillionTokens: 2.5
  },
  {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    inputUsdPerMillionTokens: 0.59,
    outputUsdPerMillionTokens: 0.79
  },
  {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    inputUsdPerMillionTokens: 0.05,
    outputUsdPerMillionTokens: 0.08
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct',
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.32
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-8b-instruct',
    inputUsdPerMillionTokens: 0.02,
    outputUsdPerMillionTokens: 0.04
  },
  {
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4-flash',
    inputUsdPerMillionTokens: 0.098,
    outputUsdPerMillionTokens: 0.196
  },
  {
    provider: 'openrouter',
    model: 'mistralai/ministral-3b-2512',
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.1
  },
  {
    provider: 'openrouter',
    model: 'meta-llama/llama-4-scout',
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.3
  },
  {
    provider: 'deterministic',
    model: 'deterministic-model',
    inputUsdPerMillionTokens: 0,
    outputUsdPerMillionTokens: 0
  }
];

export function getModelRate(provider: string, model: string) {
  return MODEL_RATES.find(
    (rate) => rate.provider === provider && rate.model === model
  );
}

export function estimateModelCostUsd(input: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const rate = getModelRate(input.provider, input.model);
  if (!rate) return null;

  return (
    (input.promptTokens / 1_000_000) * rate.inputUsdPerMillionTokens +
    (input.completionTokens / 1_000_000) * rate.outputUsdPerMillionTokens
  );
}

export function formatEstimatedCostUsd(value: number) {
  return value.toFixed(6);
}
