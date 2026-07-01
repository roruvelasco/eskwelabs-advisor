import { HttpException } from '../common/http/http-exception';
import { getAvailableProviderKeys } from './provider-availability';
import { getModelRate } from '../usage-counters/model-rates';
import type { ServerEnv } from '../config/env';
import { ModelConfigRepository } from './model-config.repository';

export class ModelConfigService {
  constructor(
    private modelConfigRepository: ModelConfigRepository,
    private env: ServerEnv
  ) {}

  async list() {
    return this.modelConfigRepository.list();
  }

  async count() {
    return this.modelConfigRepository.count();
  }

  async getForAdvisor(advisorId: string) {
    return this.modelConfigRepository.find(advisorId);
  }

  async update(
    advisorId: string,
    input: {
      provider: string;
      model: string;
      updatedBy: string;
      isEnabled?: boolean;
    }
  ) {
    const availableKeys = getAvailableProviderKeys(this.env);
    if (!availableKeys.includes(input.provider)) {
      throw new HttpException(
        422,
        `Provider "${input.provider}" is not available`,
        'model_not_available'
      );
    }

    const rate = getModelRate(input.provider, input.model);
    if (!rate) {
      throw new HttpException(
        422,
        `Model "${input.model}" is not available for provider "${input.provider}"`,
        'model_not_available'
      );
    }

    return this.modelConfigRepository.upsert(advisorId, input);
  }

  async setEnabled(advisorId: string, isEnabled: boolean, updatedBy?: string) {
    return this.modelConfigRepository.setEnabled(
      advisorId,
      isEnabled,
      updatedBy
    );
  }
}
