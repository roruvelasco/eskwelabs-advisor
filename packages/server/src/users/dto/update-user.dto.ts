import { z } from 'zod';

export const updateUserDto = z.object({
  role: z.enum(['eif', 'admin']).optional(),
  isActive: z.boolean().optional()
});

export type UpdateUserDto = z.infer<typeof updateUserDto>;
