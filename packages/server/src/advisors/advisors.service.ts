import { AdvisorsRepository } from './advisors.repository';
import { conflict, notFound } from '../common/http/http-exception';
import type { AdvisorRuntimeVersionRepository } from './advisor-runtime.repository';
import type { ModelConfigService } from '../model-config/model-config.service';
import type { PaginatedResult } from '../common/pagination';
import type { Advisor } from './advisors.schema';
import type { CreateAdvisorDto, UpdateAdvisorDto } from './dto/advisors.dto';

export class AdvisorsService {
  constructor(
    private advisorsRepository: AdvisorsRepository,
    private modelConfigService?: ModelConfigService,
    private advisorRuntimeVersionRepository?: AdvisorRuntimeVersionRepository
  ) {}

  async list() {
    return this.advisorsRepository.list();
  }

  async listForAdmin(filters: {
    status?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedResult<Advisor>> {
    return this.advisorsRepository.listForAdmin(filters);
  }

  async listPromptSources() {
    return (await this.advisorsRepository.listForAdmin({ limit: 100 })).rows;
  }

  async getActive(id: string) {
    const advisor = await this.advisorsRepository.findActive(id);
    if (!advisor) {
      throw notFound('Advisor not found');
    }
    return advisor;
  }

  async findById(id: string) {
    return this.advisorsRepository.findById(id);
  }

  async getModelConfig(advisorId: string) {
    return this.modelConfigService?.getForAdvisor(advisorId);
  }

  async create(input: CreateAdvisorDto, actorId: string) {
    const existing = await this.advisorsRepository.findById(input.id);
    if (existing) {
      throw conflict('Advisor already exists');
    }

    const advisor = await this.advisorsRepository.create({
      id: input.id,
      name: input.name,
      description: input.description,
      promptDocId: input.promptDocId,
      isActive: input.isActive,
      status: input.status
    });

    if (input.modelConfig) {
      await this.modelConfigService?.update(advisor.id, {
        ...input.modelConfig,
        updatedBy: actorId
      });
    }

    return advisor;
  }

  async update(advisorId: string, input: UpdateAdvisorDto, actorId: string) {
    const advisor = await this.advisorsRepository.update(advisorId, {
      name: input.name,
      description: input.description,
      promptDocId: input.promptDocId,
      isActive: input.isActive,
      status: input.status
    });
    if (!advisor) {
      throw notFound('Advisor not found');
    }

    if (input.modelConfig) {
      await this.modelConfigService?.update(advisorId, {
        ...input.modelConfig,
        updatedBy: actorId
      });
    }

    return advisor;
  }

  async softDisable(advisorId: string, actorId?: string) {
    const advisor = await this.advisorsRepository.softDisable(advisorId);
    if (!advisor) {
      throw notFound('Advisor not found');
    }

    await Promise.all([
      this.modelConfigService?.setEnabled(advisorId, false, actorId),
      this.advisorRuntimeVersionRepository?.retireByAdvisorId(advisorId)
    ]);

    return advisor;
  }

  async updatePromptSource(advisorId: string, promptDocId: string | null) {
    const advisor = await this.advisorsRepository.updatePromptDocId(
      advisorId,
      promptDocId
    );
    if (!advisor) {
      throw notFound('Advisor not found');
    }
    return advisor;
  }
}
