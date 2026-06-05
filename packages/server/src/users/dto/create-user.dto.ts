import { z } from 'zod';

export const createUserDto = z.object({
  email: z
    .string()
    .email()
    .transform((val) => val.toLowerCase()),
  role: z.enum(['eif', 'admin'])
});

export type CreateUserDto = z.infer<typeof createUserDto>;
