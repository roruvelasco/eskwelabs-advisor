import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { advisorsTable } from '../advisors.schema';

const advisorSelectSchema = createSelectSchema(advisorsTable);

export const advisorDto = advisorSelectSchema.pick({
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true
});

export type AdvisorDto = z.infer<typeof advisorDto>;
