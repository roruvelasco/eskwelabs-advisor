import { z } from 'zod';

export const usersFiltersDto = z.object({
  role: z.enum(['eif', 'admin']).optional(),
  search: z.string().optional()
});

export type UsersFiltersDto = z.infer<typeof usersFiltersDto>;
