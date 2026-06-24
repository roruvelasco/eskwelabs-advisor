import { createHash } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';

import { HttpException } from '../common/http/http-exception';
import type { DrizzleService } from '../db/drizzle.service';
import { knowledgeEmbeddingsTable } from './knowledge-embeddings.schema';
import type { KnowledgeUnit } from './knowledge-units.schema';
import { knowledgeUnitsTable } from './knowledge-units.schema';

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

type GroqEmbeddingResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

export class GroqEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;

  constructor(
    private apiKey: string,
    baseUrl: string = 'https://api.groq.com/openai/v1',
    private model: string = 'nomic-embed-text-v1.5'
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.apiKey) {
      throw new HttpException(
        503,
        'Groq API key is not configured for embeddings',
        'groq_embedding_not_configured'
      );
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: texts.map((t) => t.trim())
      })
    });

    if (!response.ok) {
      throw new HttpException(
        502,
        'Groq embedding request failed',
        'groq_embedding_failed'
      );
    }

    const payload = (await response.json()) as GroqEmbeddingResponse;

    return payload.data
      .sort((a, b) => a.index - b.index)
      .map((item, i) => ({
        text: texts[i],
        vector: item.embedding,
        hash: sha256(texts[i])
      }));
  }
}

export class PostgresKnowledgeIndexProvider implements KnowledgeIndexProvider {
  constructor(
    private drizzleService: DrizzleService,
    private embeddingProvider: EmbeddingProvider,
    private model: string = 'nomic-embed-text-v1.5'
  ) {}

  async upsert(units: KnowledgeUnit[]): Promise<void> {
    if (units.length === 0) return;

    const texts = units.map((unit) => unit.text);
    const embeddings = await this.embeddingProvider.embedTexts(texts);

    const rows = embeddings
      .map((embedding, index) => {
        const unit = units[index];
        if (!unit) return null;
        return {
          unitId: unit.id,
          provider: 'groq',
          model: this.model,
          dimensions: embedding.vector.length,
          embedding: embedding.vector,
          embeddingHash: embedding.hash,
          indexedAt: new Date()
        };
      })
      .filter(Boolean) as Array<{
      unitId: string;
      provider: string;
      model: string;
      dimensions: number;
      embedding: number[];
      embeddingHash: string;
      indexedAt: Date;
    }>;

    if (rows.length === 0) return;

    const unitIds = rows.map((r) => r.unitId);

    await this.drizzleService.db.transaction(async (tx) => {
      await tx
        .delete(knowledgeEmbeddingsTable)
        .where(inArray(knowledgeEmbeddingsTable.unitId, unitIds));
      await tx.insert(knowledgeEmbeddingsTable).values(rows);
    });
  }

  async search(): Promise<KnowledgeUnit[]> {
    return [];
  }

  async deleteBySourceRevision(
    sourceId: string,
    revision: string
  ): Promise<void> {
    const units = await this.drizzleService.db
      .select({ id: knowledgeUnitsTable.id })
      .from(knowledgeUnitsTable)
      .where(
        and(
          eq(knowledgeUnitsTable.sourceId, sourceId),
          eq(knowledgeUnitsTable.sourceRevision, revision)
        )
      );

    if (units.length === 0) return;

    const unitIds = units.map((u) => u.id);
    await this.drizzleService.db
      .delete(knowledgeEmbeddingsTable)
      .where(inArray(knowledgeEmbeddingsTable.unitId, unitIds));
  }
}
