import { and, desc, eq, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { advisorsTable } from './advisors.schema';
import { dnaDigestsTable } from '../prompt-cache/dna-digests.schema';
import { modelConfigTable } from '../model-config/model-config.schema';
import { promptSnapshotsTable } from '../prompt-cache/prompt-snapshots.schema';
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

  async publish(advisorId: string): Promise<AdvisorRuntimeVersion> {
    return this.drizzle.db.transaction(async (tx) => {
      const snapshotRows = await tx
        .select()
        .from(promptSnapshotsTable)
        .where(
          and(
            eq(promptSnapshotsTable.advisorId, advisorId),
            eq(promptSnapshotsTable.isActive, true)
          )
        )
        .orderBy(desc(promptSnapshotsTable.createdAt))
        .limit(1);

      const dnaRows = await tx
        .select()
        .from(dnaDigestsTable)
        .where(eq(dnaDigestsTable.isActive, true))
        .orderBy(desc(dnaDigestsTable.createdAt))
        .limit(1);

      const modelConfigRows = await tx
        .select()
        .from(modelConfigTable)
        .where(eq(modelConfigTable.advisorId, advisorId))
        .limit(1);

      const nextVersionRows = await tx
        .select({
          maxVersion: sql<number>`COALESCE(MAX(${advisorRuntimeVersionsTable.versionNumber}), 0) + 1`
        })
        .from(advisorRuntimeVersionsTable)
        .where(eq(advisorRuntimeVersionsTable.advisorId, advisorId));

      await tx
        .update(advisorRuntimeVersionsTable)
        .set({ status: 'retired', updatedAt: new Date() })
        .where(
          and(
            eq(advisorRuntimeVersionsTable.advisorId, advisorId),
            eq(advisorRuntimeVersionsTable.status, 'published')
          )
        );

      const rows = await tx
        .insert(advisorRuntimeVersionsTable)
        .values({
          advisorId,
          promptSnapshotId: snapshotRows[0]!.id,
          dnaDigestId: dnaRows[0]!.id,
          modelConfigAdvisorId: modelConfigRows[0]!.advisorId,
          versionNumber: nextVersionRows[0]?.maxVersion ?? 1,
          status: 'published',
          publishedAt: new Date()
        })
        .returning();

      await tx
        .update(advisorsTable)
        .set({
          activeRuntimeVersionId: rows[0].id,
          updatedAt: new Date()
        })
        .where(eq(advisorsTable.id, advisorId));

      return rows[0];
    });
  }
}
