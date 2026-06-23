import { Controller } from '../common/factories/controller.factory';
import { requireActor } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';

import { updateUsageLimitsDto } from './dto/usage-limits.dto';
import { UsageLimitsSerializer } from './usage-limits.serializer';
import { UsageLimitsService } from './usage-limits.service';

export class UsageLimitsController extends Controller {
  constructor(
    private usageLimitsService: UsageLimitsService,
    private usageLimitsSerializer: UsageLimitsSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/usage-limits/*', requireActor(['admin']));
    this.controller.use('/admin/usage-limits', requireActor(['admin']));

    return this.controller
      .get('/admin/usage-limits', async (c) => {
        const [config, status] = await Promise.all([
          this.usageLimitsService.getConfig(),
          this.usageLimitsService.getGlobalBudgetStatus()
        ]);
        return c.json(this.usageLimitsSerializer.config(config, status));
      })
      .put('/admin/usage-limits', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, updateUsageLimitsDto);
        const row = await this.usageLimitsService.update({
          ...input,
          updatedBy: actor.id
        });
        return c.json(this.usageLimitsSerializer.config(row, null));
      });
  }
}
