import { paginatedResponse } from '../common/pagination';
import { promptCacheDto } from './dto/prompt-cache.dto';
import type { PromptCacheEntry } from './prompt-cache.schema';

export class PromptCacheSerializer {
  list(result: { rows: PromptCacheEntry[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((row) => promptCacheDto.parse(row)),
      result.rows.length,
      result.nextCursor
    );
  }

  promptSnapshots(
    rows: Array<{
      id: string;
      advisorId: string;
      docId: string;
      revision: string;
      hash: string;
      isActive: boolean;
      createdAt: Date;
    }>
  ) {
    return {
      data: rows.map((row) => ({
        id: row.id,
        advisorId: row.advisorId,
        docId: row.docId,
        revision: row.revision,
        hash: row.hash,
        isActive: row.isActive,
        createdAt: row.createdAt
      }))
    };
  }

  dnaDigests(
    rows: Array<{
      id: string;
      docId: string;
      revision: string;
      sourceHash: string;
      hash: string;
      isActive: boolean;
      createdAt: Date;
    }>
  ) {
    return {
      data: rows.map((row) => ({
        id: row.id,
        docId: row.docId,
        revision: row.revision,
        sourceHash: row.sourceHash,
        hash: row.hash,
        isActive: row.isActive,
        createdAt: row.createdAt
      }))
    };
  }

  dnaSource(row: {
    docId: string | null;
    source: 'database' | 'active_digest' | 'env_fallback';
    updatedBy: string | null;
    updatedAt: Date | null;
  }) {
    return {
      data: {
        docId: row.docId,
        source: row.source,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt
      }
    };
  }
}
