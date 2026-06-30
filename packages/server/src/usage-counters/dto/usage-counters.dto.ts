import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { usageCountersTable } from '../usage-counters.schema';

export const usageCounterDto = createSelectSchema(usageCountersTable).pick({
  userId: true,
  dayPh: true,
  messagesToday: true,
  tokensToday: true,
  estimatedSpendTodayUsd: true
});

export type UsageCounterDto = z.infer<typeof usageCounterDto>;

export const usageSummaryQueryDto = z
  .object({
    fromDayPh: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    toDayPh: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    userId: z.string().uuid().optional(),
    topUsersLimit: z.coerce.number().int().min(1).max(20).default(5)
  })
  .refine(
    (input) =>
      !input.fromDayPh || !input.toDayPh || input.fromDayPh <= input.toDayPh,
    { message: 'fromDayPh must be before or equal to toDayPh' }
  );

export type UsageSummaryQueryDto = z.infer<typeof usageSummaryQueryDto>;
