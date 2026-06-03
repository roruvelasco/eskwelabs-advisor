import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { conversationsTable } from '../conversations.schema';

const conversationSelectSchema = createSelectSchema(conversationsTable);

export const conversationDto = conversationSelectSchema.pick({
  id: true,
  userId: true,
  advisorId: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true
});

export type ConversationDto = z.infer<typeof conversationDto>;
