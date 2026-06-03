import { z } from 'zod';

export const conversationDto = z.object({
  id: z.string(),
  advisorId: z.string(),
  title: z.string()
});

export type ConversationDto = z.infer<typeof conversationDto>;
