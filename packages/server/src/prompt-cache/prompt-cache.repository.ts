import { desc } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { promptCacheTable, type PromptCacheEntry } from './prompt-cache.schema';

type UpsertPromptCacheEntry = {
  key: string;
  valueHash: string;
  docRevision?: string | null;
  dnaDigestVersion?: string | null;
  lastGoodAt?: Date | null;
  expiresAt: Date;
};

export class PromptCacheRepository extends Repository {
  async list(): Promise<PromptCacheEntry[]> {
    return this.drizzle.db
      .select()
      .from(promptCacheTable)
      .orderBy(desc(promptCacheTable.updatedAt));
  }

  async upsert(input: UpsertPromptCacheEntry) {
    const values = {
      ...input,
      updatedAt: new Date()
    };

    const rows = await this.drizzle.db
      .insert(promptCacheTable)
      .values(values)
      .onConflictDoUpdate({
        target: promptCacheTable.key,
        set: values
      })
      .returning();

    return rows[0];
  }
}
