import { Controller } from '../common/factories/controller.factory';
import { dataResponse, paginationParamsDto } from '../common/pagination';

import { PromptCacheSerializer } from './prompt-cache.serializer';
import { PromptCacheService } from './prompt-cache.service';
import { requireActor } from '../common/middleware/auth.middleware';
import {
  PromptContextRefreshUseCase,
  PromptRollbackUseCase
} from './use-cases/prompt-cache-workflow.use-case';

export class PromptCacheController extends Controller {
  constructor(
    private promptCacheService: PromptCacheService,
    private promptCacheSerializer: PromptCacheSerializer,
    private promptContextRefreshUseCase: PromptContextRefreshUseCase,
    private promptRollbackUseCase: PromptRollbackUseCase
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
      .get('/admin/prompt-cache/health', async (c) => {
        const result = await this.promptCacheService.health();
        return c.json(dataResponse(result));
      })
      .post('/admin/prompt-cache/refresh', async (c) => {
        const actor = c.get('actor');
        const result = await this.promptContextRefreshUseCase.execute(
          actor?.id,
          'admin'
        );
        return c.json(dataResponse(result));
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
            await this.promptRollbackUseCase.activateAdvisorSnapshot(
              c.req.param('advisorId'),
              c.req.param('snapshotId'),
              actor?.id
            );
          return c.json(
            dataResponse(
              this.promptCacheSerializer.promptSnapshots([snapshot]).data[0]
            )
          );
        }
      )
      .get('/admin/prompt-cache/dna-digests', async (c) => {
        const rows = await this.promptCacheService.listDnaDigests();
        return c.json(this.promptCacheSerializer.dnaDigests(rows));
      })
      .post('/admin/prompt-cache/dna-digests/:digestId/activate', async (c) => {
        const actor = c.get('actor');
        const digest = await this.promptRollbackUseCase.activateDnaDigest(
          c.req.param('digestId'),
          actor?.id
        );
        return c.json(
          dataResponse(this.promptCacheSerializer.dnaDigests([digest]).data[0])
        );
      });
  }
}
