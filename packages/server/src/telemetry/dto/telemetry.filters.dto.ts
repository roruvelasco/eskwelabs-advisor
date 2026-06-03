import { z } from 'zod';

export const telemetryFiltersDto = z.object({
  eventName: z.string().optional()
});
