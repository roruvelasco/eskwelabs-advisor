import { Controller } from '../common/factories/controller.factory';
import {
  requireActor,
  requireConsent
} from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { notFound, validationFailed } from '../common/http/http-exception';
import { paginationParamsDto } from '../common/pagination';
import { z } from 'zod';

import type { ServerEnv } from '../config/env';
import { ConversationSharesSerializer } from './conversation-shares.serializer';
import { ConversationSharesService } from './conversation-shares.service';
import { ConversationsSerializer } from './conversations.serializer';
import { ConversationsService } from './conversations.service';
import { shareIdParamDto } from './dto/conversation-shares.dto';

const createConversationSchema = z.object({
  advisorId: z.string().min(1),
  title: z.string().min(1).optional()
});

export class ConversationController extends Controller {
  constructor(
    private conversationsService: ConversationsService,
    private conversationsSerializer: ConversationsSerializer,
    private conversationSharesService: ConversationSharesService,
    private conversationSharesSerializer: ConversationSharesSerializer,
    private serverEnv: Pick<ServerEnv, 'APP_ORIGIN'>
  ) {
    super();
  }

  routes() {
    this.controller.use('/conversations/*', requireActor(['eif', 'admin']));
    this.controller.use('/conversations', requireActor(['eif', 'admin']));
    this.controller.use('/conversations/*', requireConsent());
    this.controller.use('/conversations', requireConsent());

    return this.controller
      .get('/conversations', async (c) => {
        const actor = c.get('actor')!;
        const advisorId = c.req.query('advisorId');
        const search = c.req.query('search');
        const pagination = paginationParamsDto.parse({
          limit: c.req.query('limit'),
          cursor: c.req.query('cursor')
        });
        const result = await this.conversationsService.list(actor, {
          advisorId,
          search,
          limit: pagination.limit,
          cursor: pagination.cursor
        });
        return c.json(this.conversationsSerializer.list(result));
      })
      .post('/conversations', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, createConversationSchema);
        const row = await this.conversationsService.create(actor, input);
        return c.json(this.conversationsSerializer.single(row), 201);
      })
      .get('/conversations/:id', async (c) => {
        const actor = c.get('actor')!;
        const row = await this.conversationsService.detail(
          actor,
          c.req.param('id')
        );
        return c.json(this.conversationsSerializer.single(row));
      })
      .delete('/conversations/:id', async (c) => {
        const actor = c.get('actor')!;
        const id = c.req.param('id');
        const parsed = z.string().uuid().safeParse(id);
        if (!parsed.success) {
          throw validationFailed({ issues: parsed.error.issues });
        }
        await this.conversationsService.delete(actor, parsed.data);
        return c.body(null, 204);
      })
      .post('/conversations/:id/share', async (c) => {
        const actor = c.get('actor')!;
        const parsed = z.string().uuid().safeParse(c.req.param('id'));
        if (!parsed.success) {
          throw validationFailed({ issues: parsed.error.issues });
        }
        const share = await this.conversationSharesService.share(
          actor,
          parsed.data
        );
        return c.json(
          this.conversationSharesSerializer.link(
            share,
            this.serverEnv.APP_ORIGIN
          )
        );
      })
      .get('/share/:shareId', async (c) => {
        const parsed = shareIdParamDto.safeParse(c.req.param('shareId'));
        if (!parsed.success) {
          throw notFound();
        }
        const view = await this.conversationSharesService.sharedView(
          parsed.data
        );
        return c.json(this.conversationSharesSerializer.sharedView(view));
      });
  }
}
