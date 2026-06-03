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
