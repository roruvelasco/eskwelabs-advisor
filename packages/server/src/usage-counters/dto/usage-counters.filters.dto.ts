import { z } from 'zod';

export const usageCountersFiltersDto = z.object({
  userId: z.string().optional(),
  dayPh: z.string().optional()
});
