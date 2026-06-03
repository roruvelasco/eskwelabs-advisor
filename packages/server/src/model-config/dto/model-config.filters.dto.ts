import { z } from 'zod';

export const modelConfigFiltersDto = z.object({
  provider: z.string().optional()
});
