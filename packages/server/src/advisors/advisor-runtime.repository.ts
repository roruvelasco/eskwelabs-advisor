import { and, desc, eq, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { advisorsTable } from './advisors.schema';
import {
  advisorRuntimeVersionsTable,
  type AdvisorRuntimeVersion
} from './advisor-runtime.schema';

export type CreateRuntimeVersionInput = {
  advisorId: string;
  promptSnapshotId: string | null;
  dnaDigestId: string | null;
  modelConfigAdvisorId: string;
  versionNumber: number;
  status?: string;
  publishedAt?: Date;
  publishedBy?: string;
};

export class AdvisorRuntimeVersionRepository extends Repository {
  async findActiveForAdvisor(
    advisorId: string
  ): Promise<AdvisorRuntimeVersion | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(advisorRuntimeVersionsTable)
      .where(
        and(
          eq(advisorRuntimeVersionsTable.advisorId, advisorId),
          eq(advisorRuntimeVersionsTable.status, 'published')
        )
      )
      .orderBy(desc(advisorRuntimeVersionsTable.versionNumber))
      .limit(1);

    return rows[0];
  }

  async findById(id: string): Promise<AdvisorRuntimeVersion | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(advisorRuntimeVersionsTable)
      .where(eq(advisorRuntimeVersionsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(input: CreateRuntimeVersionInput) {
    const rows = await this.drizzle.db
      .insert(advisorRuntimeVersionsTable)
      .values({
        advisorId: input.advisorId,
        promptSnapshotId: input.promptSnapshotId,
        dnaDigestId: input.dnaDigestId,
        modelConfigAdvisorId: input.modelConfigAdvisorId,
        versionNumber: input.versionNumber,
        status: input.status ?? 'published',
        publishedAt: input.publishedAt ?? new Date(),
        publishedBy: input.publishedBy
      })
      .returning();

    return rows[0];
  }

  async setAdvisorActiveVersion(advisorId: string, runtimeVersionId: string) {
    await this.drizzle.db
      .update(advisorsTable)
      .set({ activeRuntimeVersionId: runtimeVersionId })
      .where(eq(advisorsTable.id, advisorId));
  }

  async getNextVersionNumber(advisorId: string): Promise<number> {
    const rows = await this.drizzle.db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${advisorRuntimeVersionsTable.versionNumber}), 0) + 1`
      })
      .from(advisorRuntimeVersionsTable)
      .where(eq(advisorRuntimeVersionsTable.advisorId, advisorId));

    return rows[0]?.maxVersion ?? 1;
  }

  async retireByAdvisorId(advisorId: string) {
    await this.drizzle.db
      .update(advisorRuntimeVersionsTable)
      .set({ status: 'retired' })
      .where(
        and(
          eq(advisorRuntimeVersionsTable.advisorId, advisorId),
          eq(advisorRuntimeVersionsTable.status, 'published')
        )
      );
  }
}
