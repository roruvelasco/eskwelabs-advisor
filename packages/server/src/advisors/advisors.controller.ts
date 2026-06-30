import { Controller } from '../common/factories/controller.factory';
import { dataResponse, paginationParamsDto } from '../common/pagination';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { requireActor } from '../common/middleware/auth.middleware';
import { z } from 'zod';

import { AdvisorRuntimeService } from './advisor-runtime.service';
import { AdvisorsSerializer } from './advisors.serializer';
import { AdvisorsService } from './advisors.service';
import { createAdvisorDto, updateAdvisorDto } from './dto/advisors.dto';
import { advisorsFiltersDto } from './dto/advisors.filters.dto';

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

  private async enrichAdminAdvisor(
    row: Awaited<ReturnType<AdvisorsService['findById']>>
  ) {
    if (!row) return row;

    const [modelConfig, readiness] = await Promise.all([
      this.advisorsService.getModelConfig(row.id),
      this.advisorRuntimeService.checkReadiness(row.id)
    ]);

    return {
      ...row,
      modelConfig,
      availability: readiness.ready
        ? ({ status: 'available' } as const)
        : ({
            status: 'unavailable' as const,
            reasons: readiness.reasons.map((r) => r.code)
          } as const)
    };
  }

  routes() {
    this.controller.use('/admin/advisors/*', requireActor(['admin']));
    this.controller.use('/admin/advisors', requireActor(['admin']));
    this.controller.use('/advisors/*', requireActor(['eif', 'admin']));
    this.controller.use('/advisors', requireActor(['eif', 'admin']));

    return this.controller
      .get('/admin/advisors', async (c) => {
        const filters = advisorsFiltersDto.parse({
          status: c.req.query('status'),
          search: c.req.query('search'),
          isActive: c.req.query('isActive')
        });
        const pagination = paginationParamsDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor')
        });
        const result = await this.advisorsService.listForAdmin({
          ...filters,
          ...pagination
        });
        const rows = await Promise.all(
          result.rows.map((row) => this.enrichAdminAdvisor(row))
        );
        return c.json(
          this.advisorsSerializer.adminList(
            rows.filter((row) => row !== undefined),
            pagination.limit,
            result.nextCursor
          )
        );
      })
      .post('/admin/advisors', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, createAdvisorDto);
        const row = await this.advisorsService.create(input, actor.id);
        const enriched = await this.enrichAdminAdvisor(row);
        return c.json(this.advisorsSerializer.adminSingle(enriched!), 201);
      })
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
      .post('/admin/advisors/:advisorId/publish', async (c) => {
        const row = await this.advisorRuntimeService.publish(
          c.req.param('advisorId')
        );
        return c.json(this.advisorsSerializer.runtimeVersion(row), 201);
      })
      .patch('/admin/advisors/:advisorId', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, updateAdvisorDto);
        const row = await this.advisorsService.update(
          c.req.param('advisorId'),
          input,
          actor.id
        );
        const enriched = await this.enrichAdminAdvisor(row);
        return c.json(this.advisorsSerializer.adminSingle(enriched!));
      })
      .delete('/admin/advisors/:advisorId', async (c) => {
        const actor = c.get('actor');
        const row = await this.advisorsService.softDisable(
          c.req.param('advisorId'),
          actor?.id
        );
        const enriched = await this.enrichAdminAdvisor(row);
        return c.json(this.advisorsSerializer.adminSingle(enriched!));
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
