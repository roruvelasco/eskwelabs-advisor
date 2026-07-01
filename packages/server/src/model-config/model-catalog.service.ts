import type { ServerEnv } from '../config/env';
import { getAvailableProviderKeys } from './provider-availability';
import { MODEL_RATES } from '../usage-counters/model-rates';

export interface CatalogModel {
  model: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export interface CatalogProvider {
  provider: string;
  label: string;
  models: CatalogModel[];
}

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  deterministic: 'Deterministic'
};

export class ModelCatalogService {
  constructor(private env: ServerEnv) {}

  getCatalog(): CatalogProvider[] {
    const availableKeys = getAvailableProviderKeys(this.env);
    const keySet = new Set(availableKeys);

    const ratesByProvider = new Map<string, CatalogModel[]>();

    for (const rate of MODEL_RATES) {
      if (!keySet.has(rate.provider)) continue;

      const models = ratesByProvider.get(rate.provider) ?? [];
      models.push({
        model: rate.model,
        inputUsdPerMillionTokens: rate.inputUsdPerMillionTokens,
        outputUsdPerMillionTokens: rate.outputUsdPerMillionTokens
      });
      ratesByProvider.set(rate.provider, models);
    }

    return availableKeys
      .filter((key) => ratesByProvider.has(key))
      .map((key) => ({
        provider: key,
        label:
          PROVIDER_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
        models: ratesByProvider.get(key)!
      }));
  }
}
