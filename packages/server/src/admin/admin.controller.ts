import { Controller } from '../common/factories/controller.factory';
import { dataResponse } from '../common/pagination';

import { AdminSerializer } from './admin.serializer';
import { AdminOverviewUseCase } from './use-cases/admin-overview.use-case';
import { requireActor } from '../common/middleware/auth.middleware';

export class AdminController extends Controller {
  constructor(
    private adminOverviewUseCase: AdminOverviewUseCase,
    private adminSerializer: AdminSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/*', requireActor(['admin']));
    this.controller.use('/admin', requireActor(['admin']));

    return this.controller
      .get('/admin', async (c) => {
        const overview = await this.adminOverviewUseCase.execute();
        return c.json(this.adminSerializer.overview(overview));
      })
      .get('/admin/usage', async (c) => {
        const overview = await this.adminOverviewUseCase.execute();
        return c.json(dataResponse(overview));
      });
  }
}
