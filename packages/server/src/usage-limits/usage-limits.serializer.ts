import { usageLimitsDto } from './dto/usage-limits.dto';
import type { LimitsConfig, UsageLimitsReview } from './usage-limits.service';

export class UsageLimitsSerializer {
  config(limits: LimitsConfig, status: unknown) {
    return {
      data: {
        config: usageLimitsDto.parse(limits),
        status
      }
    };
  }

  review(review: UsageLimitsReview) {
    return {
      data: {
        ...review,
        config: usageLimitsDto.parse(review.config),
        auditEvents: review.auditEvents.map((event) => ({
          ...event,
          changedByEmail: event.changedByEmail ?? undefined
        }))
      }
    };
  }
}
