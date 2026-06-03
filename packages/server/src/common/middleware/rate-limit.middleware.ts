import type { MiddlewareHandler } from 'hono';

import { getClientIp } from '../utils/client-ip';
import type { RateLimitService } from '../../rate-limit/rate-limit.service';

export function createRateLimitMiddleware(
  rateLimitService: RateLimitService
): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');
    await rateLimitService.assertAllowed(
      'api',
      actor?.id ?? getClientIp(c)
    );
    await next();
  };
}
