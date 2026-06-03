import { Controller } from '../common/factories/controller.factory';

import { AdvisorsSerializer } from './advisors.serializer';
import { AdvisorsService } from './advisors.service';
import { requireAllowlistedEifOrAdmin } from '../common/middleware/auth.middleware';
import type { ServerEnv } from '../config/env';

export class AdvisorController extends Controller {
  constructor(
    private advisorsService: AdvisorsService,
    private advisorsSerializer: AdvisorsSerializer,
    private env: ServerEnv
  ) {
    super();
  }

  routes() {
    if (this.env) {
      this.controller.use('/advisors/*', requireAllowlistedEifOrAdmin(this.env));
      this.controller.use('/advisors', requireAllowlistedEifOrAdmin(this.env));
    }

    return this.controller.get('/advisors', async (c) => {
      const rows = await this.advisorsService.list();
      return c.json(this.advisorsSerializer.list(rows));
    });
  }
}
