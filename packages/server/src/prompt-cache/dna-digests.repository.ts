import { desc, eq, sql } from 'drizzle-orm';

import { HttpException } from '../common/http/http-exception';
import { Repository } from '../common/factories/repository.factory';
import { dnaDigestsTable, type DnaDigestRow } from './dna-digests.schema';

type CreateDnaDigestInput = {
  docId: string;
  revision: string;
  sourceHash: string;
  digestText: string;
  hash: string;
  validationStatus?: string | null;
  validationReason?: string | null;
};

type AdvisoryLockTransaction = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export class DnaDigestsRepository extends Repository {
  private async lockDna(tx: AdvisoryLockTransaction) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dna-digest'))`);
  }

  async findActive(): Promise<DnaDigestRow | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(dnaDigestsTable)
      .where(eq(dnaDigestsTable.isActive, true))
      .orderBy(desc(dnaDigestsTable.createdAt))
      .limit(1);

    return rows[0];
  }

  async list(): Promise<DnaDigestRow[]> {
    return this.drizzle.db
      .select()
      .from(dnaDigestsTable)
      .orderBy(desc(dnaDigestsTable.createdAt));
  }

  async createActive(input: CreateDnaDigestInput) {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockDna(tx);

      await tx
        .update(dnaDigestsTable)
        .set({ isActive: false })
        .where(eq(dnaDigestsTable.isActive, true));

      const rows = await tx.insert(dnaDigestsTable).values(input).returning();
      return rows[0];
    });
  }

  async activate(digestId: string) {
    return this.drizzle.db.transaction(async (tx) => {
      await this.lockDna(tx);

      const targetRows = await tx
        .select()
        .from(dnaDigestsTable)
        .where(eq(dnaDigestsTable.id, digestId))
        .limit(1);

      if (!targetRows[0]) {
        throw new HttpException(
          404,
          'DNA digest not found',
          'dna_digest_not_found'
        );
      }

      await tx
        .update(dnaDigestsTable)
        .set({ isActive: false })
        .where(eq(dnaDigestsTable.isActive, true));

      const rows = await tx
        .update(dnaDigestsTable)
        .set({ isActive: true })
        .where(eq(dnaDigestsTable.id, digestId))
        .returning();

      return rows[0];
    });
  }
}
