import { z } from 'zod';

export const advisorDto = z.object({
  id: z.string(),
  name: z.string()
});

export type AdvisorDto = z.infer<typeof advisorDto>;
