import { Controller } from '../common/factories/controller.factory';
import { paginationParamsDto } from '../common/pagination';

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
        const pagination = paginationParamsDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor')
        });
        const result = await this.promptCacheService.list(
          pagination.limit,
          pagination.cursor
        );
        return c.json(this.promptCacheSerializer.list(result));
      })
      .post('/admin/prompt-cache/refresh', async (c) => {
        const actor = c.get('actor');
        const result = await this.promptCacheService.refresh(actor?.id);
        return c.json({ data: result });
      })
      .get('/admin/prompt-cache/advisors/:advisorId/snapshots', async (c) => {
        const rows = await this.promptCacheService.listAdvisorSnapshots(
          c.req.param('advisorId')
        );
        return c.json(this.promptCacheSerializer.promptSnapshots(rows));
      })
      .post(
        '/admin/prompt-cache/advisors/:advisorId/snapshots/:snapshotId/activate',
        async (c) => {
          const actor = c.get('actor');
          const snapshot =
            await this.promptCacheService.activateAdvisorSnapshot(
              c.req.param('advisorId'),
              c.req.param('snapshotId'),
              actor?.id
            );
          return c.json({
            data: this.promptCacheSerializer.promptSnapshots([snapshot]).data[0]
          });
        }
      )
      .get('/admin/prompt-cache/dna-digests', async (c) => {
        const rows = await this.promptCacheService.listDnaDigests();
        return c.json(this.promptCacheSerializer.dnaDigests(rows));
      })
      .post('/admin/prompt-cache/dna-digests/:digestId/activate', async (c) => {
        const actor = c.get('actor');
        const digest = await this.promptCacheService.activateDnaDigest(
          c.req.param('digestId'),
          actor?.id
        );
        return c.json({
          data: this.promptCacheSerializer.dnaDigests([digest]).data[0]
        });
      });
  }
}
