import { eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import {
  dnaSourceConfigTable,
  type DnaSourceConfigRow
} from './dna-source-config.schema';

const DEFAULT_DNA_SOURCE_CONFIG_ID = 'default';

export class DnaSourceConfigRepository extends Repository {
  async find(): Promise<DnaSourceConfigRow | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(dnaSourceConfigTable)
      .where(eq(dnaSourceConfigTable.id, DEFAULT_DNA_SOURCE_CONFIG_ID))
      .limit(1);

    return rows[0];
  }

  async upsert(input: { docId: string; updatedBy?: string | null }) {
    const now = new Date();
    const values = {
      id: DEFAULT_DNA_SOURCE_CONFIG_ID,
      docId: input.docId,
      updatedBy: input.updatedBy ?? null,
      updatedAt: now
    };

    const rows = await this.drizzle.db
      .insert(dnaSourceConfigTable)
      .values(values)
      .onConflictDoUpdate({
        target: dnaSourceConfigTable.id,
        set: values
      })
      .returning();

    return rows[0];
  }
}
