import { z } from 'zod';

export const messagesFiltersDto = z.object({
  conversationId: z.string().optional()
});
