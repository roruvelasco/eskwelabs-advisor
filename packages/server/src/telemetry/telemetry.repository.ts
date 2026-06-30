import { and, count, desc, eq, lt, or } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, paginateResult } from '../common/pagination';
import type { PaginatedResult } from '../common/pagination';
import { telemetryEventsTable, type TelemetryEvent } from './telemetry.schema';

export type TelemetrySeverity = 'info' | 'warning' | 'error';

export class TelemetryRepository extends Repository {
  async list({
    eventName,
    limit = 50,
    cursor
  }: {
    eventName?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginatedResult<TelemetryEvent>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(
            telemetryEventsTable.createdAt,
            new Date(decoded.createdAt as string)
          ),
          and(
            eq(
              telemetryEventsTable.createdAt,
              new Date(decoded.createdAt as string)
            ),
            lt(telemetryEventsTable.id, decoded.id as string)
          )
        )
      : undefined;

    const whereConditions = [
      ...(eventName ? [eq(telemetryEventsTable.eventName, eventName)] : []),
      ...(cursorConditions ? [cursorConditions] : [])
    ];

    const rows = await this.drizzle.db
      .select()
      .from(telemetryEventsTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(
        desc(telemetryEventsTable.createdAt),
        desc(telemetryEventsTable.id)
      )
      .limit(limit + 1);

    return paginateResult(rows, limit, (last) => ({
      createdAt: last.createdAt.toISOString(),
      id: last.id
    }));
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
