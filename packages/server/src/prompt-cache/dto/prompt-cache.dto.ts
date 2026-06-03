import { z } from 'zod';

export const promptCacheDto = z.object({
  key: z.string(),
  valueHash: z.string()
});
