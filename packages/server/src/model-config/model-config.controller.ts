import { Controller } from '../common/factories/controller.factory';
import { dataResponse } from '../common/pagination';

import { ModelConfigSerializer } from './model-config.serializer';
import { ModelConfigService } from './model-config.service';
import { ModelCatalogService } from './model-catalog.service';
import type { TelemetryService } from '../telemetry/telemetry.service';
import { requireActor } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { updateModelConfigDto } from './dto/model-config.dto';

export class ModelConfigController extends Controller {
  constructor(
    private modelConfigService: ModelConfigService,
    private modelConfigSerializer: ModelConfigSerializer,
    private telemetryService: TelemetryService,
    private modelCatalogService: ModelCatalogService
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
      .get('/admin/model-config/catalog', async (c) => {
        const providers = this.modelCatalogService.getCatalog();
        return c.json(dataResponse({ providers }));
      })
      .put('/admin/model-config/:advisorId', async (c) => {
        const actor = c.get('actor')!;
        const advisorId = c.req.param('advisorId');
        const input = await parseJsonBody(c, updateModelConfigDto);
        const row = await this.modelConfigService.update(advisorId, {
          ...input,
          updatedBy: actor.id
        });
        try {
          await this.telemetryService.record(
            'admin_model_changed',
            actor.id,
            'info',
            {
              advisorId,
              provider: input.provider,
              model: input.model
            }
          );
        } catch {
          // telemetry failure must not block the response
        }
        return c.json(dataResponse(row));
      });
  }
}
