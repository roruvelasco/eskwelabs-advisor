import { HttpException } from '../common/http/http-exception';
import {
  estimateModelCostUsd,
  getModelRate
} from '../usage-counters/model-rates';

export class ModelRateService {
  assertRateConfigured(provider: string, model: string): void {
    const rate = getModelRate(provider, model);
    if (!rate) {
      throw new HttpException(
        422,
        'Model rate is not configured',
        'model_rate_not_configured'
      );
    }
  }

  estimatedTurnBudget(
    config: { provider: string; model: string },
    maxOutputTokens: number
  ) {
    const estimatedCostUsd = estimateModelCostUsd({
      provider: config.provider,
      model: config.model,
      promptTokens: maxOutputTokens,
      completionTokens: maxOutputTokens
    });

    if (estimatedCostUsd === null) {
      throw new HttpException(
        422,
        'Model rate is not configured',
        'model_rate_not_configured'
      );
    }

    return {
      estimatedTokens: maxOutputTokens * 2,
      estimatedCostUsd
    };
  }
}
