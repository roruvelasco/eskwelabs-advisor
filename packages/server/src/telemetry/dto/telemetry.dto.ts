import { z } from 'zod';

export const telemetryDto = z.object({
  eventName: z.string(),
  payload: z.record(z.unknown()).optional()
});
