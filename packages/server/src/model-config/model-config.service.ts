import { ModelConfigRepository } from './model-config.repository';

export class ModelConfigService {
  constructor(private modelConfigRepository: ModelConfigRepository) {}

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
