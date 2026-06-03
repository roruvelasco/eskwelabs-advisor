import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema
} from 'drizzle-zod';
import { z } from 'zod';

import { modelConfigTable } from '../model-config.schema';

export const modelConfigDto = createSelectSchema(modelConfigTable).pick({
  advisorId: true,
  provider: true,
  model: true,
  isEnabled: true,
  updatedBy: true,
  updatedAt: true
});

export type ModelConfigDto = z.infer<typeof modelConfigDto>;

export const createModelConfigDto = createInsertSchema(modelConfigTable, {
  provider: (s: z.ZodString) => s.min(1),
  model: (s: z.ZodString) => s.min(1)
}).pick({ advisorId: true, provider: true, model: true });

export const updateModelConfigDto = createUpdateSchema(modelConfigTable, {
  provider: (s: z.ZodString) => s.min(1),
  model: (s: z.ZodString) => s.min(1)
}).pick({ provider: true, model: true });

export type UpdateModelConfigDto = z.infer<typeof updateModelConfigDto>;
