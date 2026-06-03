import { z } from 'zod';

export const adminFiltersDto = z.object({
  section: z.string().optional()
});
