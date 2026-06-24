import { createHash } from 'node:crypto';

import type { KnowledgeUnit } from './knowledge-units.schema';

export type EmbeddingResult = {
  text: string;
  vector: number[];
  hash: string;
};

export interface EmbeddingProvider {
  embedTexts(texts: string[]): Promise<EmbeddingResult[]>;
}

export interface KnowledgeIndexProvider {
  upsert(units: KnowledgeUnit[]): Promise<void>;
  search(input: {
    query: string;
    advisorId?: string;
    limit?: number;
  }): Promise<KnowledgeUnit[]>;
  deleteBySourceRevision(sourceId: string, revision: string): Promise<void>;
}

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  async embedTexts(texts: string[]) {
    return texts.map((text) => ({
      text,
      vector: [text.length],
      hash: sha256(text)
    }));
  }
}

export class NoopKnowledgeIndexProvider implements KnowledgeIndexProvider {
  async upsert() {
    return;
  }

  async search() {
    return [];
  }

  async deleteBySourceRevision() {
    return;
  }
}
