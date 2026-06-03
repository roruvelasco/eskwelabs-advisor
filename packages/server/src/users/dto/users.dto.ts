import { z } from 'zod';

export const userDto = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['eif', 'admin']),
  isActive: z.boolean()
});

export type UserDto = z.infer<typeof userDto>;
