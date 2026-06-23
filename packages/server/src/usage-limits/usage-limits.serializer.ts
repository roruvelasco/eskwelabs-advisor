import { usageLimitsDto } from './dto/usage-limits.dto';
import type { LimitsConfig } from './usage-limits.service';

export class UsageLimitsSerializer {
  config(limits: LimitsConfig, status: unknown) {
    return {
      data: {
        config: usageLimitsDto.parse(limits),
        status
      }
    };
  }
}
