import { Controller } from '../common/factories/controller.factory';
import { paginationParamsDto } from '../common/pagination';

import { UsageCountersSerializer } from './usage-counters.serializer';
import { UsageCountersService } from './usage-counters.service';
import { requireActor } from '../common/middleware/auth.middleware';

export class UsageCounterController extends Controller {
  constructor(
    private usageCountersService: UsageCountersService,
    private usageCountersSerializer: UsageCountersSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/usage-counters/*', requireActor(['admin']));
    this.controller.use('/admin/usage-counters', requireActor(['admin']));
    this.controller.use('/admin/usage-users', requireActor(['admin']));

    return this.controller
      .get('/admin/usage-counters', async (c) => {
        const userId = c.req.query('userId');
        const dayPh = c.req.query('dayPh');
        const pagination = paginationParamsDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor')
        });
        const result = await this.usageCountersService.list(
          userId,
          dayPh,
          pagination.limit,
          pagination.cursor
        );
        return c.json(this.usageCountersSerializer.list(result));
      })
      .get('/admin/usage-users', async (c) => {
        const userId = c.req.query('userId');
        const dayPh = c.req.query('dayPh');
        const pagination = paginationParamsDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor')
        });
        const result = await this.usageCountersService.list(
          userId,
          dayPh,
          pagination.limit,
          pagination.cursor
        );
        return c.json(this.usageCountersSerializer.list(result));
      });
  }
}
