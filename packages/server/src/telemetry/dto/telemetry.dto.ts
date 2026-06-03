import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { telemetryEventsTable } from '../telemetry.schema';

export const telemetryDto = z.object({
  eventName: z.string(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export type TelemetryDto = z.infer<typeof telemetryDto>;

export const telemetryEventDto = createSelectSchema(telemetryEventsTable).pick({
  id: true,
  eventName: true,
  actorId: true,
  severity: true,
  payload: true,
  createdAt: true
});

export type TelemetryEventDto = z.infer<typeof telemetryEventDto>;
