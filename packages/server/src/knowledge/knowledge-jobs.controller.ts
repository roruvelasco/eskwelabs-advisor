import { Hono } from 'hono';

import type { HonoEnv } from '../common/utils/hono';
import type { ServerEnv } from '../config/env';
import type { KnowledgeService } from './knowledge.service';

export class KnowledgeJobsController {
  constructor(
    private knowledgeService: KnowledgeService,
    private env: ServerEnv
  ) {}

  routes() {
    const app = new Hono<HonoEnv>();

    app.get('/internal/jobs/knowledge/refresh', async (c) => {
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

      return c.json(await this.knowledgeService.refreshPublishedSources());
    });

    return app;
  }
}
