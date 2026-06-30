import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema
} from 'drizzle-zod';
import { z } from 'zod';

import { advisorsTable } from '../advisors.schema';

const advisorSelectSchema = createSelectSchema(advisorsTable);
const advisorIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const promptDocIdSchema = z.string().trim().min(1).nullable();

export const advisorDto = advisorSelectSchema.pick({
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true
});

export type AdvisorDto = z.infer<typeof advisorDto>;

export const advisorModelConfigDto = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  isEnabled: z.boolean().optional()
});

export const createAdvisorDto = createInsertSchema(advisorsTable, {
  id: () => advisorIdSchema,
  name: (schema) => schema.trim().min(1),
  description: (schema) => schema.trim(),
  promptDocId: () => promptDocIdSchema.optional(),
  status: (schema) => schema.trim().min(1)
})
  .pick({
    id: true,
    name: true,
    description: true,
    promptDocId: true,
    isActive: true,
    status: true
  })
  .extend({
    modelConfig: advisorModelConfigDto.optional()
  })
  .partial({ description: true, status: true });

export type CreateAdvisorDto = z.infer<typeof createAdvisorDto>;

export const updateAdvisorDto = createUpdateSchema(advisorsTable, {
  name: (schema) => schema.trim().min(1),
  description: (schema) => schema.trim(),
  promptDocId: () => promptDocIdSchema.optional(),
  status: (schema) => schema.trim().min(1)
})
  .pick({
    name: true,
    description: true,
    promptDocId: true,
    isActive: true,
    status: true
  })
  .extend({
    modelConfig: advisorModelConfigDto.optional()
  });

export type UpdateAdvisorDto = z.infer<typeof updateAdvisorDto>;
