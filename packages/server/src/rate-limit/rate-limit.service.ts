import { rateLimited } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';
import type { RedisService } from '../cache/redis.service';

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
    private env: ServerEnv
  ) {}

  async assertAllowed(
    scope: string,
    subject: string
  ): Promise<RateLimitResult> {
    const key = `rate-limit:${scope}:${subject}`;
    const count = await this.redisService.incrWithTtlAtomic(
      key,
      this.env.RATE_LIMIT_WINDOW_SECONDS
    );
    const result = {
      count,
      limit: this.env.RATE_LIMIT_MAX_REQUESTS,
      remaining: Math.max(this.env.RATE_LIMIT_MAX_REQUESTS - count, 0),
      resetSeconds: this.env.RATE_LIMIT_WINDOW_SECONDS,
      windowSeconds: this.env.RATE_LIMIT_WINDOW_SECONDS
    };

    if (count > this.env.RATE_LIMIT_MAX_REQUESTS) {
      throw rateLimited('Rate limit exceeded', result);
    }

    return result;
  }
}
