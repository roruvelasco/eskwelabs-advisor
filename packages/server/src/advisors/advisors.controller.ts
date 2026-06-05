import { Controller } from '../common/factories/controller.factory';
import { requireActor } from '../common/middleware/auth.middleware';

import { AdvisorsSerializer } from './advisors.serializer';
import { AdvisorsService } from './advisors.service';

export class AdvisorController extends Controller {
  constructor(
    private advisorsService: AdvisorsService,
    private advisorsSerializer: AdvisorsSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/advisors/*', requireActor(['eif', 'admin']));
    this.controller.use('/advisors', requireActor(['eif', 'admin']));

    return this.controller.get('/advisors', async (c) => {
      const rows = await this.advisorsService.list();
      return c.json(this.advisorsSerializer.list(rows));
    });
  }
}
