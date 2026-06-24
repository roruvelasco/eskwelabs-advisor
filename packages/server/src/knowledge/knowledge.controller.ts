import { Controller } from '../common/factories/controller.factory';
import { dataResponse } from '../common/pagination';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { requireActor } from '../common/middleware/auth.middleware';
import {
  createKnowledgeSourceDto,
  knowledgeSearchDto
} from './dto/knowledge.dto';
import { knowledgeListFiltersDto } from './dto/knowledge.filters.dto';
import type { KnowledgeSerializer } from './knowledge.serializer';
import type { KnowledgeService } from './knowledge.service';

export class KnowledgeController extends Controller {
  constructor(
    private knowledgeService: KnowledgeService,
    private knowledgeSerializer: KnowledgeSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/knowledge/*', requireActor(['admin']));
    this.controller.use('/admin/knowledge', requireActor(['admin']));

    return this.controller
      .get('/admin/knowledge/sources', async (c) => {
        const filters = knowledgeListFiltersDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor'),
          status: c.req.query('status'),
          advisorScope: c.req.query('advisorScope')
        });
        const result = await this.knowledgeService.listSources(filters);
        return c.json(this.knowledgeSerializer.sources(result));
      })
      .post('/admin/knowledge/sources', async (c) => {
        const actor = c.get('actor');
        const input = await parseJsonBody(c, createKnowledgeSourceDto);
        const source = await this.knowledgeService.createSource(
          { ...input, metadata: input.metadata ?? undefined },
          actor?.id
        );
        return c.json(this.knowledgeSerializer.source(source));
      })
      .post('/admin/knowledge/sources/:sourceId/refresh', async (c) => {
        const result = await this.knowledgeService.refreshSource(
          c.req.param('sourceId')
        );
        return c.json(dataResponse(result));
      })
      .post('/admin/knowledge/refresh', async (c) => {
        return c.json(
          dataResponse(await this.knowledgeService.refreshPublishedSources())
        );
      })
      .get('/admin/knowledge/sources/:sourceId/units', async (c) => {
        const units = await this.knowledgeService.listUnitsForSource(
          c.req.param('sourceId')
        );
        return c.json(this.knowledgeSerializer.units(units));
      })
      .get('/admin/knowledge/health', async (c) => {
        return c.json(dataResponse(await this.knowledgeService.health()));
      })
      .get('/admin/knowledge/search', async (c) => {
        const query = knowledgeSearchDto.parse({
          query: c.req.query('query'),
          advisorId: c.req.query('advisorId'),
          limit: c.req.query('limit')
        });
        const units = await this.knowledgeService.search(query);
        return c.json(this.knowledgeSerializer.units(units));
      });
  }
}
