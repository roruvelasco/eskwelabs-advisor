import { rateLimited } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';
import type { RedisService } from '../cache/redis.service';
import type { UsageLimitsService } from '../usage-limits/usage-limits.service';

export interface RateLimitResult {
  count: number;
  limit: number;
  remaining: number;
  resetSeconds: number;
  windowSeconds: number;
}

export class RateLimitService {
  constructor(
    private redisService: RedisService,
    private usageLimitsService: UsageLimitsService,
    private env: ServerEnv
  ) {}

  async assertAllowed(
    scope: string,
    subject: string
  ): Promise<RateLimitResult> {
    let windowSeconds = this.env.RATE_LIMIT_WINDOW_SECONDS;
    let maxRequests = this.env.RATE_LIMIT_MAX_REQUESTS;

    try {
      const limits = await this.usageLimitsService.getConfig();
      if (limits.rateLimitWindowSeconds > 0) {
        windowSeconds = limits.rateLimitWindowSeconds;
        maxRequests = limits.rateLimitMaxRequests;
      }
    } catch {
      // fall back to env defaults
    }

    const key = `rate-limit:${scope}:${subject}`;
    const count = await this.redisService.incrWithTtlAtomic(key, windowSeconds);
    const result = {
      count,
      limit: maxRequests,
      remaining: Math.max(maxRequests - count, 0),
      resetSeconds: windowSeconds,
      windowSeconds
    };

    if (count > maxRequests) {
      throw rateLimited('Rate limit exceeded', result);
    }

    return result;
  }
}
