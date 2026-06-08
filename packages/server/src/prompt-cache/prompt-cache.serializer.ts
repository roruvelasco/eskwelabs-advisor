export class PromptCacheSerializer {
  list(rows: unknown[]) {
    return { data: rows };
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
}
