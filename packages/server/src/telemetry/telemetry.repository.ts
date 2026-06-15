import { count, desc } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { telemetryEventsTable, type TelemetryEvent } from './telemetry.schema';

export type TelemetrySeverity = 'info' | 'warning' | 'error';

export class TelemetryRepository extends Repository {
  async list(): Promise<TelemetryEvent[]> {
    return this.drizzle.db
      .select()
      .from(telemetryEventsTable)
      .orderBy(desc(telemetryEventsTable.createdAt));
  }

  async count(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(telemetryEventsTable);
    return rows[0]?.count ?? 0;
  }

  async insert(input: {
    eventName: string;
    actorId?: string;
    severity?: TelemetrySeverity;
    payload?: Record<string, unknown>;
  }) {
    const rows = await this.drizzle.db
      .insert(telemetryEventsTable)
      .values({
        eventName: input.eventName,
        actorId: input.actorId,
        severity: input.severity ?? 'info',
        payload: input.payload ?? {}
      })
      .returning();

    return rows[0];
  }
}
