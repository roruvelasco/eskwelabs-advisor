import { ModelConfigRepository } from './model-config.repository';

export class ModelConfigService {
  constructor(private modelConfigRepository: ModelConfigRepository) {}

  async list() {
    return this.modelConfigRepository.list();
  }

  async getForAdvisor(advisorId: string) {
    return this.modelConfigRepository.find(advisorId);
  }

  async update(
    advisorId: string,
    input: { provider: string; model: string; updatedBy: string; isEnabled?: boolean }
  ) {
    return this.modelConfigRepository.upsert(advisorId, input);
  }
}
