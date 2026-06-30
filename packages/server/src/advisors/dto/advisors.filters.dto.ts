import { z } from 'zod';

export const advisorsFiltersDto = z.object({
  status: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
});

export type AdvisorsFiltersDto = z.infer<typeof advisorsFiltersDto>;
