import { Hono } from 'hono';

import type { HonoEnv } from '../common/utils/hono';
import type { ServerEnv } from '../config/env';
import type { PromptContextRefreshUseCase } from './use-cases/prompt-cache-workflow.use-case';

export class PromptCacheJobsController {
  constructor(
    private promptContextRefreshUseCase: PromptContextRefreshUseCase,
    private env: ServerEnv
  ) {}

  routes() {
    const app = new Hono<HonoEnv>();

    app.get('/internal/jobs/prompt-cache/refresh', async (c) => {
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

      const result = await this.promptContextRefreshUseCase.execute(
        undefined,
        'cron'
      );

      return c.json(result);
    });

    return app;
  }
}
