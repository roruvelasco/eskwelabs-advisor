import { Controller } from '../common/factories/controller.factory';
import { dataResponse } from '../common/pagination';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { requireActor } from '../common/middleware/auth.middleware';
import { z } from 'zod';

import { AdvisorRuntimeService } from './advisor-runtime.service';
import { AdvisorsSerializer } from './advisors.serializer';
import { AdvisorsService } from './advisors.service';

const updatePromptSourceDto = z.object({
  promptDocId: z.string().trim().min(1).nullable()
});

export class AdvisorController extends Controller {
  constructor(
    private advisorsService: AdvisorsService,
    private advisorRuntimeService: AdvisorRuntimeService,
    private advisorsSerializer: AdvisorsSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/advisors/*', requireActor(['admin']));
    this.controller.use('/admin/advisors', requireActor(['admin']));
    this.controller.use('/advisors/*', requireActor(['eif', 'admin']));
    this.controller.use('/advisors', requireActor(['eif', 'admin']));

    return this.controller
      .get('/admin/advisors/prompt-sources', async (c) => {
        const rows = await this.advisorsService.listPromptSources();
        return c.json(this.advisorsSerializer.promptSources(rows));
      })
      .patch('/admin/advisors/:advisorId/prompt-source', async (c) => {
        const input = await parseJsonBody(c, updatePromptSourceDto);
        const row = await this.advisorsService.updatePromptSource(
          c.req.param('advisorId'),
          input.promptDocId
        );
        return c.json(
          dataResponse(this.advisorsSerializer.promptSources([row]).data[0])
        );
      })
      .get('/advisors', async (c) => {
        const rows = await this.advisorsService.list();
        const withAvailability = await Promise.all(
          rows.map(async (row) => {
            const result = await this.advisorRuntimeService.checkReadiness(
              row.id
            );
            return {
              ...row,
              availability: result.ready
                ? ({ status: 'available' } as const)
                : ({
                    status: 'unavailable' as const,
                    reasons: result.reasons.map((r) => r.code)
                  } as const)
            };
          })
        );
        return c.json(this.advisorsSerializer.list(withAvailability));
      });
  }
}
