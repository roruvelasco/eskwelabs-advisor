import { z } from 'zod';

export const modelConfigDto = z.object({
  advisorId: z.string(),
  provider: z.string(),
  model: z.string()
});
