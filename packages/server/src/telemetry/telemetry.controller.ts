import { Controller } from '../common/factories/controller.factory';

import { TelemetrySerializer } from './telemetry.serializer';
import { TelemetryService } from './telemetry.service';
import { requireActor } from '../common/middleware/auth.middleware';

export class TelemetryController extends Controller {
  constructor(
    private telemetryService: TelemetryService,
    private telemetrySerializer: TelemetrySerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/telemetry/*', requireActor(['admin']));
    this.controller.use('/admin/telemetry', requireActor(['admin']));

    return this.controller.get('/admin/telemetry', async (c) => {
      const rows = await this.telemetryService.list();
      return c.json(this.telemetrySerializer.list(rows));
    });
  }
}
