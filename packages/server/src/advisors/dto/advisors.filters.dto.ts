import { z } from 'zod';

export const advisorsFiltersDto = z.object({
  search: z.string().optional()
});

export type AdvisorsFiltersDto = z.infer<typeof advisorsFiltersDto>;
