import { z } from 'zod';

export const usageCounterDto = z.object({
  userId: z.string(),
  dayPh: z.string(),
  messagesToday: z.number()
});
