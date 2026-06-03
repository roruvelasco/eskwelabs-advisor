import { Controller } from '../common/factories/controller.factory';

import { ModelConfigSerializer } from './model-config.serializer';
import { ModelConfigService } from './model-config.service';
import { z } from 'zod';
import { requireActor } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';

const updateModelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1)
});

export class ModelConfigController extends Controller {
  constructor(
    private modelConfigService: ModelConfigService,
    private modelConfigSerializer: ModelConfigSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/model-config/*', requireActor(['admin']));
    this.controller.use('/admin/model-config', requireActor(['admin']));

    return this.controller
      .get('/admin/model-config', async (c) => {
        const rows = await this.modelConfigService.list();
        return c.json(this.modelConfigSerializer.list(rows));
      })
      .put('/admin/model-config/:advisorId', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, updateModelConfigSchema);
        const row = await this.modelConfigService.update(
          c.req.param('advisorId'),
          {
            ...input,
            updatedBy: actor.id
          }
        );
        return c.json({ data: row });
      });
  }
}
