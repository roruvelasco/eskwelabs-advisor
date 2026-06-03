import { Controller } from '../common/factories/controller.factory';

import { AdminSerializer } from './admin.serializer';
import { AdminService } from './admin.service';
import { requireActor } from '../common/middleware/auth.middleware';

export class AdminController extends Controller {
  constructor(
    private adminService: AdminService,
    private adminSerializer: AdminSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/admin/*', requireActor(['admin']));
    this.controller.use('/admin', requireActor(['admin']));

    return this.controller
      .get('/admin', async (c) => {
        const overview = await this.adminService.overview();
        return c.json(this.adminSerializer.overview(overview));
      })
      .get('/admin/usage', async (c) => {
        const overview = await this.adminService.overview();
        return c.json({ data: overview });
      });
  }
}
