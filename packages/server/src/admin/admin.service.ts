import { AdminRepository } from './admin.repository';
import type { ModelConfigService } from '../model-config/model-config.service';
import type { PromptCacheService } from '../prompt-cache/prompt-cache.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { UsageCountersService } from '../usage-counters/usage-counters.service';
import type { UsersService } from '../users/users.service';

export class AdminService {
  constructor(
    private adminRepository: AdminRepository,
    private usageCountersService: UsageCountersService,
    private modelConfigService: ModelConfigService,
    private promptCacheService: PromptCacheService,
    private telemetryService: TelemetryService,
    private usersService: UsersService
  ) {}

  async overview() {
    const [overview, usage, modelConfig, promptCache, telemetry, users] =
      await Promise.all([
        this.adminRepository.overview(),
        this.usageCountersService.list(),
        this.modelConfigService.list(),
        this.promptCacheService.list(),
        this.telemetryService.list(),
        this.usersService.list()
      ]);

    return {
      ...overview,
      counts: {
        usageRows: usage.length,
        modelConfigs: modelConfig.length,
        promptCacheEntries: promptCache.length,
        telemetryEvents: telemetry.length,
        users: users.length
      }
    };
  }
}
