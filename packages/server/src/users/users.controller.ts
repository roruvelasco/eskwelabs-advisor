import { Controller } from '../common/factories/controller.factory';

import { UsersSerializer } from './users.serializer';
import { UsersService } from './users.service';
import { requireActor } from '../common/middleware/auth.middleware';
import { requireAllowlistedEifOrAdmin } from '../common/middleware/auth.middleware';
import type { ServerEnv } from '../config/env';

export class UsersController extends Controller {
  constructor(
    private usersService: UsersService,
    private usersSerializer: UsersSerializer,
    private env: ServerEnv
  ) {
    super();
  }

  routes() {
    if (this.env) {
      this.controller.use('/consent', requireAllowlistedEifOrAdmin(this.env));
    }
    this.controller.use('/admin/users/*', requireActor(['admin']));
    this.controller.use('/admin/users', requireActor(['admin']));

    return this.controller
      .post('/consent', async (c) => {
        const actor = c.get('actor')!;
        const row = await this.usersService.acknowledgeConsent(actor.id);
        return c.json({ data: row });
      })
      .get('/admin/users', async (c) => {
        const rows = await this.usersService.list();
        return c.json(this.usersSerializer.list(rows));
      });
  }
}
