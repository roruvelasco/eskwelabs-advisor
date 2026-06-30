import { HttpException } from '../common/http/http-exception';
import type { ModelRateService } from '../model-config/model-rate.service';
import type { ModelConfigService } from '../model-config/model-config.service';
import type {
  PromptContextLoader,
  PreparedPromptContext
} from '../prompt-cache/prompt-context.service';
import type { DnaDigestsRepository } from '../prompt-cache/dna-digests.repository';
import type { PromptSnapshotsRepository } from '../prompt-cache/prompt-snapshots.repository';
import type { AdvisorRuntimeVersionRepository } from './advisor-runtime.repository';
import type { AdvisorsRepository } from './advisors.repository';

export type ResolvedAdvisorRuntime = {
  advisorId: string;
  advisorName: string;
  runtimeVersionId: string;
  promptContext: PreparedPromptContext;
  modelConfig: {
    provider: string;
    model: string;
    isEnabled: boolean;
  };
};

export type AdvisorReadinessFailure = {
  code: string;
  message: string;
};

export type AdvisorReadinessResult =
  | { ready: true; reasons: [] }
  | { ready: false; reasons: AdvisorReadinessFailure[] };

export class AdvisorRuntimeService {
  constructor(
    private advisorsRepository: AdvisorsRepository,
    private runtimeVersionRepository: AdvisorRuntimeVersionRepository,
    private modelConfigService: ModelConfigService,
    private modelRateService: ModelRateService,
    private promptContextLoader: PromptContextLoader,
    private promptSnapshotsRepository?: PromptSnapshotsRepository,
    private dnaDigestsRepository?: DnaDigestsRepository
  ) {}

  async resolveModelConfig(advisorId: string) {
    const advisor = await this.advisorsRepository.findById(advisorId);

    if (!advisor) {
      throw new HttpException(404, 'Advisor not found', 'advisor_not_found');
    }

    if (!advisor.isActive || advisor.status === 'disabled') {
      throw new HttpException(
        422,
        'Advisor is not available for chat',
        'advisor_inactive'
      );
    }

    const modelConfig = await this.modelConfigService.getForAdvisor(advisorId);

    if (!modelConfig?.isEnabled) {
      throw new HttpException(
        422,
        'Advisor model configuration is disabled',
        'advisor_model_disabled'
      );
    }

    this.modelRateService.assertRateConfigured(
      modelConfig.provider,
      modelConfig.model
    );

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      modelConfig: {
        provider: modelConfig.provider,
        model: modelConfig.model,
        isEnabled: modelConfig.isEnabled
      }
    };
  }

  async resolveRunnableVersion(
    advisorId: string
  ): Promise<ResolvedAdvisorRuntime> {
    const advisor = await this.advisorsRepository.findById(advisorId);

    if (!advisor) {
      throw new HttpException(404, 'Advisor not found', 'advisor_not_found');
    }

    if (!advisor.isActive || advisor.status === 'disabled') {
      throw new HttpException(
        422,
        'Advisor is not available for chat',
        'advisor_inactive'
      );
    }

    const runtime =
      await this.runtimeVersionRepository.findActiveForAdvisor(advisorId);

    if (!runtime) {
      throw new HttpException(
        422,
        'Advisor has not been published',
        'advisor_not_published'
      );
    }

    const promptContext =
      await this.promptContextLoader.getForAdvisor(advisorId);

    const modelConfig = await this.modelConfigService.getForAdvisor(advisorId);

    if (!modelConfig?.isEnabled) {
      throw new HttpException(
        422,
        'Advisor model configuration is disabled',
        'advisor_model_disabled'
      );
    }

    this.modelRateService.assertRateConfigured(
      modelConfig.provider,
      modelConfig.model
    );

    return {
      advisorId: advisor.id,
      advisorName: advisor.name,
      runtimeVersionId: runtime.id,
      promptContext,
      modelConfig: {
        provider: modelConfig.provider,
        model: modelConfig.model,
        isEnabled: modelConfig.isEnabled
      }
    };
  }

  async checkReadiness(advisorId: string): Promise<AdvisorReadinessResult> {
    const reasons: AdvisorReadinessFailure[] = [];

    const advisor = await this.advisorsRepository.findById(advisorId);
    if (!advisor) {
      reasons.push({ code: 'advisor_not_found', message: 'Advisor not found' });
      return { ready: false, reasons };
    }

    if (!advisor.isActive) {
      reasons.push({
        code: 'advisor_inactive',
        message: 'Advisor is not active'
      });
    }

    if (advisor.status === 'disabled') {
      reasons.push({
        code: 'advisor_disabled',
        message: 'Advisor has been disabled'
      });
    }

    const runtime =
      await this.runtimeVersionRepository.findActiveForAdvisor(advisorId);
    if (!runtime) {
      reasons.push({
        code: 'advisor_not_published',
        message: 'Advisor has no published runtime version'
      });
    }

    const modelConfig = await this.modelConfigService.getForAdvisor(advisorId);
    if (!modelConfig) {
      reasons.push({
        code: 'model_config_missing',
        message: 'Model configuration is missing'
      });
    } else if (!modelConfig.isEnabled) {
      reasons.push({
        code: 'model_config_disabled',
        message: 'Model configuration is disabled'
      });
    } else {
      try {
        this.modelRateService.assertRateConfigured(
          modelConfig.provider,
          modelConfig.model
        );
      } catch {
        reasons.push({
          code: 'model_rate_missing',
          message: 'Model rate is not configured'
        });
      }
    }

    if (reasons.length > 0) {
      return { ready: false, reasons };
    }

    return { ready: true, reasons: [] };
  }

  async publish(advisorId: string) {
    const advisor = await this.advisorsRepository.findById(advisorId);

    if (!advisor) {
      throw new HttpException(404, 'Advisor not found', 'advisor_not_found');
    }

    if (!advisor.isActive || advisor.status !== 'active') {
      throw new HttpException(422, 'Advisor is not active', 'advisor_inactive');
    }

    if (!advisor.promptDocId) {
      throw new HttpException(
        422,
        'Advisor prompt source is not configured',
        'advisor_prompt_not_configured'
      );
    }

    const [snapshot, digest, modelConfig] = await Promise.all([
      this.promptSnapshotsRepository?.findActive(advisorId),
      this.dnaDigestsRepository?.findActive(),
      this.modelConfigService.getForAdvisor(advisorId)
    ]);

    if (!snapshot) {
      throw new HttpException(
        422,
        'Advisor has no active prompt snapshot',
        'advisor_prompt_snapshot_missing'
      );
    }

    if (!digest) {
      throw new HttpException(
        422,
        'DNA digest is not active',
        'dna_digest_missing'
      );
    }

    if (!modelConfig) {
      throw new HttpException(
        422,
        'Advisor model configuration is missing',
        'model_config_missing'
      );
    }

    if (!modelConfig.isEnabled) {
      throw new HttpException(
        422,
        'Advisor model configuration is disabled',
        'advisor_model_disabled'
      );
    }

    this.modelRateService.assertRateConfigured(
      modelConfig.provider,
      modelConfig.model
    );

    return this.runtimeVersionRepository.publish(advisorId);
  }
}
