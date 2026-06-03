import { z } from 'zod';

export const conversationsFiltersDto = z.object({
  advisorId: z.string().optional()
});
