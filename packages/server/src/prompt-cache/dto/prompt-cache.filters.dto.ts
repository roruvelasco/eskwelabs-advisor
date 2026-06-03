import { z } from 'zod';

export const promptCacheFiltersDto = z.object({
  key: z.string().optional()
});
