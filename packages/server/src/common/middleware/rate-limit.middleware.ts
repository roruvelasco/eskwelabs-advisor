import type { Context, MiddlewareHandler } from 'hono';

import { getClientIp } from '../utils/client-ip';
import { HttpException } from '../http/http-exception';
import type {
  RateLimitResult,
  RateLimitService
} from '../../rate-limit/rate-limit.service';
import type { TelemetryService } from '../../telemetry/telemetry.service';
import type { HonoEnv } from '../utils/hono';

type RateLimitHeaders = Pick<
  RateLimitResult,
  'limit' | 'remaining' | 'resetSeconds'
>;

export function createRateLimitMiddleware(
  rateLimitService: RateLimitService,
  telemetryService?: TelemetryService
): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');
    const subject = actor?.id ?? getClientIp(c);
    try {
      const result = await rateLimitService.assertAllowed('api', subject);
      setRateLimitHeaders(c, result);
    } catch (error) {
      if (error instanceof HttpException && error.code === 'rate_limited') {
        setRateLimitHeaders(c, error.safeDetails);
        const retryAfterSeconds = numberDetail(
          error.safeDetails,
          'resetSeconds'
        );
        if (retryAfterSeconds !== undefined) {
          c.header('Retry-After', String(retryAfterSeconds));
        }
      }
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

function setRateLimitHeaders(
  c: Context<HonoEnv>,
  details: Partial<RateLimitHeaders> | Record<string, unknown> | undefined
) {
  const limit = numberDetail(details, 'limit');
  const remaining = numberDetail(details, 'remaining');
  const resetSeconds = numberDetail(details, 'resetSeconds');

  if (limit !== undefined) {
    c.header('RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Limit', String(limit));
  }
  if (remaining !== undefined) {
    c.header('RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Remaining', String(remaining));
  }
  if (resetSeconds !== undefined) {
    c.header('RateLimit-Reset', String(resetSeconds));
    c.header('X-RateLimit-Reset', String(resetSeconds));
  }
}

function numberDetail(
  details: Record<string, unknown> | undefined,
  key: string
) {
  const value = details?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(Math.trunc(value), 0)
    : undefined;
}
