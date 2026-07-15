import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { messagesTable } from '../../messages/messages.schema';
import { conversationSharesTable } from '../conversation-shares.schema';
import { conversationsTable } from '../conversations.schema';

export const shareIdParamDto = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

export const conversationShareLinkDto = createSelectSchema(
  conversationSharesTable
)
  .pick({ shareId: true })
  .extend({ url: z.string().url() });

export type ConversationShareLinkDto = z.infer<typeof conversationShareLinkDto>;

export const sharedMessageDto = createSelectSchema(messagesTable)
  .pick({ role: true, content: true })
  .extend({ createdAt: z.string() });

export const sharedConversationViewDto = z.object({
  conversation: createSelectSchema(conversationsTable)
    .pick({ title: true })
    .extend({ advisorName: z.string(), createdAt: z.string() }),
  messages: z.array(sharedMessageDto)
});

export type SharedConversationViewDto = z.infer<
  typeof sharedConversationViewDto
>;
