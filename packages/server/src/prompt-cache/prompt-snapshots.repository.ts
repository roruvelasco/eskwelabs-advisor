import { and, desc, eq, sql } from 'drizzle-orm';

import { HttpException } from '../common/http/http-exception';
import { Repository } from '../common/factories/repository.factory';
import {
  promptSnapshotsTable,
  type PromptSnapshotRow
} from './prompt-snapshots.schema';

type CreatePromptSnapshotInput = {
  advisorId: string;
  docId: string;
  revision: string;
  contentText: string;
  hash: string;
};

type AdvisoryLockTransaction = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export class PromptSnapshotsRepository extends Repository {
  private lockKey(advisorId: string) {
    return `prompt-snapshot:${advisorId}`;
  }

  private async lockAdvisor(tx: AdvisoryLockTransaction, advisorId: string) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${this.lockKey(advisorId)}))`
    );
  }

  async findActive(advisorId: string): Promise<PromptSnapshotRow | undefined> {
    const rows = await this.drizzle.db
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

    return rows[0];
  }

  async listForAdvisor(advisorId: string): Promise<PromptSnapshotRow[]> {
    return this.drizzle.db
      .select()
      .from(promptSnapshotsTable)
      .where(eq(promptSnapshotsTable.advisorId, advisorId))
      .orderBy(desc(promptSnapshotsTable.createdAt));
  }

  async createActive(input: CreatePromptSnapshotInput) {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockAdvisor(tx, input.advisorId);

      await tx
        .update(promptSnapshotsTable)
        .set({ isActive: false })
        .where(
          and(
            eq(promptSnapshotsTable.advisorId, input.advisorId),
            eq(promptSnapshotsTable.isActive, true)
          )
        );

      const rows = await tx
        .insert(promptSnapshotsTable)
        .values(input)
        .returning();

      return rows[0];
    });
  }

  async activate(advisorId: string, snapshotId: string) {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockAdvisor(tx, advisorId);

      const targetRows = await tx
        .select()
        .from(promptSnapshotsTable)
        .where(
          and(
            eq(promptSnapshotsTable.id, snapshotId),
            eq(promptSnapshotsTable.advisorId, advisorId)
          )
        )
        .limit(1);
      const target = targetRows[0];

      if (!target) {
        throw new HttpException(
          404,
          'Prompt snapshot not found',
          'prompt_snapshot_not_found'
        );
      }

      await tx
        .update(promptSnapshotsTable)
        .set({ isActive: false })
        .where(
          and(
            eq(promptSnapshotsTable.advisorId, advisorId),
            eq(promptSnapshotsTable.isActive, true)
          )
        );

      const rows = await tx
        .update(promptSnapshotsTable)
        .set({ isActive: true })
        .where(eq(promptSnapshotsTable.id, snapshotId))
        .returning();

      return rows[0];
    });
  }
}
