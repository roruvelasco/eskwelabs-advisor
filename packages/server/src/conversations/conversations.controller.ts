import { Controller } from '../common/factories/controller.factory';
import { requireActor } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { z } from 'zod';

import { ConversationsSerializer } from './conversations.serializer';
import { ConversationsService } from './conversations.service';

const createConversationSchema = z.object({
  advisorId: z.string().min(1),
  title: z.string().min(1).optional()
});

export class ConversationController extends Controller {
  constructor(
    private conversationsService: ConversationsService,
    private conversationsSerializer: ConversationsSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/conversations/*', requireActor(['eif', 'admin']));
    this.controller.use('/conversations', requireActor(['eif', 'admin']));

    return this.controller
      .get('/conversations', async (c) => {
        const actor = c.get('actor')!;
        const rows = await this.conversationsService.list(
          actor,
          c.req.query('advisorId')
        );
        return c.json(this.conversationsSerializer.list(rows));
      })
      .post('/conversations', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, createConversationSchema);
        const row = await this.conversationsService.create(actor, input);
        return c.json({ data: row }, 201);
      })
      .get('/conversations/:id', async (c) => {
        const actor = c.get('actor')!;
        const row = await this.conversationsService.detail(
          actor,
          c.req.param('id')
        );
        return c.json({ data: row });
      });
  }
}
