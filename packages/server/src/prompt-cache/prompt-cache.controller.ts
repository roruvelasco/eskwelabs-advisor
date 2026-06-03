import { Controller } from '../common/factories/controller.factory';

import { PromptCacheSerializer } from './prompt-cache.serializer';
import { PromptCacheService } from './prompt-cache.service';
import { requireActor } from '../common/middleware/auth.middleware';

export class PromptCacheController extends Controller {
  constructor(
    private promptCacheService: PromptCacheService,
    private promptCacheSerializer: PromptCacheSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/prompt-cache/*', requireActor(['admin']));
    this.controller.use('/admin/prompt-cache', requireActor(['admin']));

    return this.controller
      .get('/admin/prompt-cache', async (c) => {
        const rows = await this.promptCacheService.list();
        return c.json(this.promptCacheSerializer.list(rows));
      })
      .post('/admin/prompt-cache/refresh', async (c) => {
        const result = await this.promptCacheService.refresh();
        return c.json({ data: result });
      });
  }
}
