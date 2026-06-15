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
    const [
      overview,
      usageCount,
      modelConfigCount,
      promptCacheCount,
      telemetryCount,
      usersCount
    ] = await Promise.all([
      this.adminRepository.overview(),
      this.usageCountersService.count(),
      this.modelConfigService.count(),
      this.promptCacheService.count(),
      this.telemetryService.count(),
      this.usersService.count()
    ]);

    return {
      ...overview,
      counts: {
        usageRows: usageCount,
        modelConfigs: modelConfigCount,
        promptCacheEntries: promptCacheCount,
        telemetryEvents: telemetryCount,
        users: usersCount
      }
    };
  }
}
