import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { messagesTable } from '../messages.schema';

const messageSelectSchema = createSelectSchema(messagesTable);

export const messageDto = messageSelectSchema.pick({
  id: true,
  conversationId: true,
  userId: true,
  role: true,
  content: true,
  provider: true,
  model: true,
  status: true,
  blockReason: true,
  createdAt: true
});

export type MessageDto = z.infer<typeof messageDto>;
