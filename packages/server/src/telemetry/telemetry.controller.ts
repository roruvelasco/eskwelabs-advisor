import { Controller } from '../common/factories/controller.factory';
import { paginationParamsDto } from '../common/pagination';

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
      const eventName = c.req.query('eventName');
      const pagination = paginationParamsDto.parse({
        limit: c.req.query('limit'),
        cursor: c.req.query('cursor')
      });
      const result = await this.telemetryService.list(
        eventName,
        pagination.limit,
        pagination.cursor
      );
      return c.json(this.telemetrySerializer.list(result));
    });
  }
}
