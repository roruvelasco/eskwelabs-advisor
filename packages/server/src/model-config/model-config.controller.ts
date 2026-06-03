import { Controller } from '../common/factories/controller.factory';

import { ModelConfigSerializer } from './model-config.serializer';
import { ModelConfigService } from './model-config.service';
import { requireActor } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { updateModelConfigDto } from './dto/model-config.dto';

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
        const input = await parseJsonBody(c, updateModelConfigDto);
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
