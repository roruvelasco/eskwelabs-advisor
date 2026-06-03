import { Controller } from '../common/factories/controller.factory';

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

    return this.controller.get('/admin/usage-counters', async (c) => {
      const rows = await this.usageCountersService.list();
      return c.json(this.usageCountersSerializer.list(rows));
    }).get('/admin/usage-users', async (c) => {
      const rows = await this.usageCountersService.list();
      return c.json(this.usageCountersSerializer.list(rows));
    });
  }
}
