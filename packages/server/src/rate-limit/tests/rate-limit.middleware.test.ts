import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { HttpException } from '../../common/http/http-exception';
import { errorHandler } from '../../common/middleware/error.middleware';
import { createRateLimitMiddleware } from '../../common/middleware/rate-limit.middleware';
import type { HonoEnv } from '../../common/utils/hono';

describe('rate limit middleware', () => {
  test('records request_blocked telemetry when rate limited', async () => {
    const telemetry: Array<{ eventName: string; payload: unknown }> = [];
    const app = new Hono<HonoEnv>();

    app.onError(errorHandler);
    app.use(
      '*',
      createRateLimitMiddleware(
        {
          assertAllowed: async () => {
            throw new HttpException(429, 'Rate limit exceeded', 'rate_limited');
          }
        } as never,
        {
          record: async (
            eventName: string,
            _actorId: string | undefined,
            _severity: string,
            payload: unknown
          ) => {
            telemetry.push({ eventName, payload });
          }
        } as never
      )
    );
    app.get('/api/example', (c) => c.json({ ok: true }));

    const response = await app.request('/api/example');

    expect(response.status).toBe(429);
    expect(telemetry).toEqual([
      {
        eventName: 'request_blocked',
        payload: expect.objectContaining({
          code: 'rate_limited',
          reason: 'rate'
        })
      }
    ]);
  });
});
