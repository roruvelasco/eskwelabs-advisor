import { Hono } from 'hono';
import { z } from 'zod';

import type { HonoEnv } from '../common/utils/hono';
import type { ServerEnv } from '../config/env';
import type { ConversationTitleWorker } from './conversation-title-worker';
import {
  TITLE_GENERATION_DRAIN_LIMIT,
  TITLE_GENERATION_MAX_DRAIN_LIMIT
} from './title-generation.constants';

const drainQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional()
});

export class ConversationTitleJobsController {
  constructor(
    private worker: ConversationTitleWorker,
    private env: ServerEnv
  ) {}

  routes() {
    const app = new Hono<HonoEnv>();

    app.get('/internal/jobs/conversation-titles/drain', async (c) => {
      const secret = this.env.CRON_SECRET;

      if (!secret) {
        return c.json({ error: 'Cron secret not configured' }, 500);
      }

      const auth = c.req.header('authorization');

      if (!auth || !auth.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const token = auth.slice(7);

      if (token !== secret) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const query = drainQuerySchema.safeParse(c.req.query());

      if (!query.success) {
        return c.json({ error: 'Invalid limit parameter' }, 400);
      }

      const limit = Math.min(
        Math.max(query.data.limit ?? TITLE_GENERATION_DRAIN_LIMIT, 1),
        TITLE_GENERATION_MAX_DRAIN_LIMIT
      );

      const result = await this.worker.drain(limit);

      return c.json(result);
    });

    return app;
  }
}
