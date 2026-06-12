import { z } from 'zod';

export const conversationDto = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  advisorId: z.string(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ConversationDto = z.infer<typeof conversationDto>;
