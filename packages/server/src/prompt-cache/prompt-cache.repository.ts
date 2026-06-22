import { and, asc, count, desc, eq, gt, lt, or } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, paginateResult } from '../common/pagination';
import type { PaginatedResult } from '../common/pagination';
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
  async list({
    limit = 50,
    cursor
  }: {
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginatedResult<PromptCacheEntry>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(promptCacheTable.updatedAt, new Date(decoded.updatedAt as string)),
          and(
            eq(
              promptCacheTable.updatedAt,
              new Date(decoded.updatedAt as string)
            ),
            gt(promptCacheTable.key, decoded.key as string)
          )
        )
      : undefined;

    const rows = await this.drizzle.db
      .select()
      .from(promptCacheTable)
      .where(cursorConditions ?? undefined)
      .orderBy(desc(promptCacheTable.updatedAt), asc(promptCacheTable.key))
      .limit(limit + 1);

    return paginateResult(rows, limit, (last) => ({
      updatedAt: last.updatedAt.toISOString(),
      key: last.key
    }));
  }

  async count(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(promptCacheTable);
    return rows[0]?.count ?? 0;
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
