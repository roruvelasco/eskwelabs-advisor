import { Controller } from '../common/factories/controller.factory';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { notFound } from '../common/http/http-exception';
import { requireActor } from '../common/middleware/auth.middleware';

import { UsersSerializer } from './users.serializer';
import { UsersService } from './users.service';
import { createUserDto } from './dto/create-user.dto';
import { updateUserDto } from './dto/update-user.dto';

export class UsersController extends Controller {
  constructor(
    private usersService: UsersService,
    private usersSerializer: UsersSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/consent', requireActor(['eif']));
    this.controller.use('/admin/users/*', requireActor(['admin']));
    this.controller.use('/admin/users', requireActor(['admin']));

    return this.controller
      .get('/consent', async (c) => {
        const actor = c.get('actor')!;
        const user = await this.usersService.findById(actor.id);
        return c.json({
          consentedAt: user?.consentAcknowledgedAt ?? null
        });
      })
      .post('/consent', async (c) => {
        const actor = c.get('actor')!;
        const row = await this.usersService.acknowledgeConsent(actor.id);
        return c.json({ data: row });
      })
      .get('/admin/users', async (c) => {
        const rows = await this.usersService.list();
        return c.json(this.usersSerializer.list(rows));
      })
      .post('/admin/users', async (c) => {
        const body = await parseJsonBody(c, createUserDto);
        const user = await this.usersService.createOrReactivate(
          body.email,
          body.role
        );
        return c.json({ data: user }, 201);
      })
      .patch('/admin/users/:userId', async (c) => {
        const actor = c.get('actor')!;
        const userId = c.req.param('userId');
        const body = await parseJsonBody(c, updateUserDto);

        const user = await this.usersService.update(actor, userId, body);
        if (!user) {
          throw notFound('User not found');
        }
        return c.json({ data: user });
      });
  }
}
