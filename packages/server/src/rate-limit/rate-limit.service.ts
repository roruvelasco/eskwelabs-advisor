import { rateLimited } from '../common/http/http-exception';
import type { ServerEnv } from '../config/env';
import type { RedisService } from '../cache/redis.service';

export class RateLimitService {
  constructor(
    private redisService: RedisService,
    private env: ServerEnv
  ) {}

  async assertAllowed(scope: string, subject: string) {
    const key = `rate-limit:${scope}:${subject}`;
    const count = await this.redisService.incrWithTtl(
      key,
      this.env.RATE_LIMIT_WINDOW_SECONDS
    );

    if (count > this.env.RATE_LIMIT_MAX_REQUESTS) {
      throw rateLimited();
    }

    return {
      count,
      limit: this.env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: this.env.RATE_LIMIT_WINDOW_SECONDS
    };
  }
}
