import type { MiddlewareHandler } from 'hono';

import { getClientIp } from '../utils/client-ip';
import type { RateLimitService } from '../../rate-limit/rate-limit.service';
import type { TelemetryService } from '../../telemetry/telemetry.service';

export function createRateLimitMiddleware(
  rateLimitService: RateLimitService,
  telemetryService?: TelemetryService
): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');
    const subject = actor?.id ?? getClientIp(c);
    try {
      await rateLimitService.assertAllowed('api', subject);
    } catch (error) {
      try {
        await telemetryService?.record(
          'request_blocked',
          actor?.id,
          'warning',
          {
            code:
              error instanceof Error && 'code' in error
                ? String(error.code)
                : 'rate_limited',
            reason: 'rate',
            subject
          }
        );
      } catch (telemetryError) {
        void telemetryError;
      }
      throw error;
    }
    await next();
  };
}
