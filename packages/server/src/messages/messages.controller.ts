import { Controller } from '../common/factories/controller.factory';
import {
  requireActor,
  requireConsent
} from '../common/middleware/auth.middleware';
import { parseJsonBody } from '../common/middleware/validation.middleware';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { MessagesSerializer } from './messages.serializer';
import { MessagesService } from './messages.service';

const chatTurnSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    advisorId: z.string().min(1).optional(),
    content: z.string().min(1).max(8000),
    clientTurnId: z.string().optional()
  })
  .refine((data) => Boolean(data.conversationId) !== Boolean(data.advisorId), {
    message: 'Provide exactly one of conversationId or advisorId'
  });

export class MessageController extends Controller {
  constructor(
    private messagesService: MessagesService,
    private messagesSerializer: MessagesSerializer
  ) {
    super();
  }

  routes() {
    this.controller.use('/messages/*', requireActor(['eif', 'admin']));
    this.controller.use('/messages', requireActor(['eif', 'admin']));
    this.controller.use('/chat-turn', requireActor(['eif', 'admin']));
    this.controller.use('/chat-turn/stream', requireActor(['eif', 'admin']));
    this.controller.use('/messages/*', requireConsent());
    this.controller.use('/messages', requireConsent());
    this.controller.use('/chat-turn', requireConsent());
    this.controller.use('/chat-turn/stream', requireConsent());

    return this.controller
      .get('/messages', async (c) => {
        const actor = c.get('actor')!;
        const conversationId = c.req.query('conversationId');
        if (!conversationId) {
          return c.json(this.messagesSerializer.list([]));
        }
        const rows = await this.messagesService.list(actor, conversationId);
        return c.json(this.messagesSerializer.list(rows));
      })
      .post('/chat-turn', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, chatTurnSchema);
        const turn = await this.messagesService.chatTurn(actor, input);
        return c.json({ data: turn }, 201);
      })
      .post('/chat-turn/stream', async (c) => {
        const actor = c.get('actor')!;
        const input = await parseJsonBody(c, chatTurnSchema);

        return streamSSE(c, async (stream) => {
          try {
            for await (const event of this.messagesService.streamChatTurn(
              actor,
              input
            )) {
              if (event.type === 'conversation.ready') {
                await stream.writeSSE({
                  event: 'conversation.ready',
                  data: JSON.stringify(event.data)
                });
              } else if (event.type === 'chunk') {
                await stream.writeSSE({
                  event: 'chunk',
                  data: event.content
                });
              } else {
                await stream.writeSSE({
                  event: 'final',
                  data: JSON.stringify(event.data)
                });
              }
            }
          } catch (error) {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify({
                error: {
                  code:
                    error instanceof Error && 'code' in error
                      ? String(error.code)
                      : 'chat_stream_error',
                  message:
                    error instanceof Error ? error.message : 'Chat stream error'
                }
              })
            });
          }
        });
      });
  }
}
