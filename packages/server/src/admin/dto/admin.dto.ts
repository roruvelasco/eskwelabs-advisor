import { z } from 'zod';

export const adminDto = z.object({
  status: z.string()
});
