import { createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';

import { usageLimitsTable } from '../usage-limits.schema';

export const usageLimitsDto = createSelectSchema(usageLimitsTable).pick({
  id: true,
  maxMessagesPerUserPerDay: true,
  maxTokensPerUserPerDay: true,
  dailyBudgetUsd: true,
  monthlyBudgetUsd: true,
  rateLimitWindowSeconds: true,
  rateLimitMaxRequests: true,
  updatedBy: true,
  updatedAt: true
});

export type UsageLimitsDto = z.infer<typeof usageLimitsDto>;

export const updateUsageLimitsDto = createUpdateSchema(usageLimitsTable, {
  maxMessagesPerUserPerDay: (s) => s.int().positive(),
  maxTokensPerUserPerDay: (s) => s.int().positive(),
  dailyBudgetUsd: (s) =>
    s
      .transform((v) => (typeof v === 'number' ? String(v) : v))
      .pipe(z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive number')),
  monthlyBudgetUsd: (s) =>
    s
      .transform((v) => (typeof v === 'number' ? String(v) : v))
      .pipe(z.string().regex(/^\d+(\.\d+)?$/, 'Must be a positive number')),
  rateLimitWindowSeconds: (s) => s.int().positive(),
  rateLimitMaxRequests: (s) => s.int().positive()
})
  .pick({
    maxMessagesPerUserPerDay: true,
    maxTokensPerUserPerDay: true,
    dailyBudgetUsd: true,
    monthlyBudgetUsd: true,
    rateLimitWindowSeconds: true,
    rateLimitMaxRequests: true
  })
  .required();

export type UpdateUsageLimitsDto = z.infer<typeof updateUsageLimitsDto>;
