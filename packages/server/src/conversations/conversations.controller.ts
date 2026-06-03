import { Controller } from '../common/factories/controller.factory';

import { ConversationsSerializer } from './conversations.serializer';
import { ConversationsService } from './conversations.service';
import { z } from 'zod';
import { requireAllowlistedEifOrAdmin } from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import type { ServerEnv } from '../config/env';

const createConversationSchema = z.object({
  advisorId: z.string().min(1),
  title: z.string().min(1).optional()
});

export class ConversationController extends Controller {
  constructor(
    private conversationsService: ConversationsService,
    private conversationsSerializer: ConversationsSerializer,
    private env: ServerEnv
  ) {
    super();
  }

  routes() {
    if (this.env) {
      this.controller.use(
        '/conversations/*',
        requireAllowlistedEifOrAdmin(this.env)
      );
      this.controller.use(
        '/conversations',
        requireAllowlistedEifOrAdmin(this.env)
      );
    }

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
