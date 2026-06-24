import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql
} from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, paginateResult } from '../common/pagination';
import type { PaginatedResult } from '../common/pagination';
import { knowledgeEmbeddingsTable } from './knowledge-embeddings.schema';
import {
  knowledgeRulesTable,
  type KnowledgeRule
} from './knowledge-rules.schema';
import {
  knowledgeSourcesTable,
  type KnowledgeSource
} from './knowledge-sources.schema';
import {
  knowledgeUnitsTable,
  type KnowledgeUnit
} from './knowledge-units.schema';
import { messageKnowledgeAuditTable } from './message-knowledge-audit.schema';

export type CreateKnowledgeSourceInput = {
  sourceType: string;
  externalId: string;
  title: string;
  url?: string | null;
  owner?: string | null;
  status?: string;
  audience?: string;
  advisorScope?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

export type CreateKnowledgeUnitInput = {
  sourceId: string;
  sourceRevision: string;
  sectionPath: string;
  contentType: string;
  advisorScope: string;
  audience: string;
  status?: string;
  text: string;
  summary?: string | null;
  contentHash: string;
  metadata?: Record<string, unknown>;
};

export type CreateKnowledgeAuditInput = {
  messageId: string;
  unitId?: string | null;
  ruleId?: string | null;
  sourceRevision?: string | null;
  contentHash?: string | null;
  selectionRank: number;
  score?: string | null;
  resolverStrategy: string;
  usedInPrompt: boolean;
};

export class KnowledgeRepository extends Repository {
  async listSources({
    limit = 50,
    cursor,
    status,
    advisorScope
  }: {
    limit?: number;
    cursor?: string;
    status?: string;
    advisorScope?: string;
  } = {}): Promise<PaginatedResult<KnowledgeSource>> {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const cursorConditions = decoded
      ? or(
          lt(
            knowledgeSourcesTable.updatedAt,
            new Date(decoded.updatedAt as string)
          ),
          and(
            eq(
              knowledgeSourcesTable.updatedAt,
              new Date(decoded.updatedAt as string)
            ),
            gt(knowledgeSourcesTable.id, decoded.id as string)
          )
        )
      : undefined;

    const whereConditions = [
      cursorConditions,
      status ? eq(knowledgeSourcesTable.status, status) : undefined,
      advisorScope
        ? eq(knowledgeSourcesTable.advisorScope, advisorScope)
        : undefined
    ].filter(Boolean);

    const rows = await this.drizzle.db
      .select()
      .from(knowledgeSourcesTable)
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(
        desc(knowledgeSourcesTable.updatedAt),
        asc(knowledgeSourcesTable.id)
      )
      .limit(limit + 1);

    return paginateResult(rows, limit, (last) => ({
      updatedAt: last.updatedAt.toISOString(),
      id: last.id
    }));
  }

  async countSources(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(knowledgeSourcesTable);
    return rows[0]?.count ?? 0;
  }

  async createSource(input: CreateKnowledgeSourceInput) {
    const rows = await this.drizzle.db
      .insert(knowledgeSourcesTable)
      .values({
        ...input,
        status: input.status ?? 'draft',
        audience: input.audience ?? 'advisor',
        advisorScope: input.advisorScope ?? 'global',
        contentType: input.contentType ?? 'advisor_reference',
        metadata: input.metadata ?? {}
      })
      .returning();

    return rows[0];
  }

  async findSourceById(id: string): Promise<KnowledgeSource | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async updateSourceIngestion(input: {
    sourceId: string;
    revision: string;
    sourceHash: string;
    status: string;
    lastIngestedAt: Date;
  }) {
    const rows = await this.drizzle.db
      .update(knowledgeSourcesTable)
      .set({
        revision: input.revision,
        sourceHash: input.sourceHash,
        status: input.status,
        lastIngestedAt: input.lastIngestedAt,
        updatedAt: new Date()
      })
      .where(eq(knowledgeSourcesTable.id, input.sourceId))
      .returning();

    return rows[0];
  }

  async replaceUnitsForSourceRevision(input: {
    sourceId: string;
    sourceRevision: string;
    units: CreateKnowledgeUnitInput[];
  }) {
    return this.drizzle.db.transaction(async (tx) => {
      const oldUnitIds = await tx
        .select({ id: knowledgeUnitsTable.id })
        .from(knowledgeUnitsTable)
        .where(eq(knowledgeUnitsTable.sourceId, input.sourceId));

      if (oldUnitIds.length > 0) {
        await tx.delete(knowledgeEmbeddingsTable).where(
          inArray(
            knowledgeEmbeddingsTable.unitId,
            oldUnitIds.map((u) => u.id)
          )
        );
      }

      await tx
        .update(knowledgeUnitsTable)
        .set({ status: 'retired', updatedAt: new Date() })
        .where(eq(knowledgeUnitsTable.sourceId, input.sourceId));

      if (input.units.length === 0) return [];

      const rows = await tx
        .insert(knowledgeUnitsTable)
        .values(input.units)
        .returning();

      return rows;
    });
  }

  async listUnitsForSource(sourceId: string): Promise<KnowledgeUnit[]> {
    return this.drizzle.db
      .select()
      .from(knowledgeUnitsTable)
      .where(eq(knowledgeUnitsTable.sourceId, sourceId))
      .orderBy(desc(knowledgeUnitsTable.createdAt));
  }

  async searchPublishedUnits(input: {
    query: string;
    advisorId?: string;
    contentTypes?: string[];
    limit?: number;
  }): Promise<KnowledgeUnit[]> {
    const limit = input.limit ?? 6;
    const tsQuery = this.buildTsQuery(input.query);
    if (!tsQuery) return [];

    const now = new Date();

    const scopeConditions = input.advisorId
      ? inArray(knowledgeUnitsTable.advisorScope, ['global', input.advisorId])
      : eq(knowledgeUnitsTable.advisorScope, 'global');

    const activeDateCondition = and(
      or(
        isNull(knowledgeUnitsTable.effectiveFrom),
        lt(knowledgeUnitsTable.effectiveFrom, now)
      ),
      or(
        isNull(knowledgeUnitsTable.effectiveTo),
        gt(knowledgeUnitsTable.effectiveTo, now)
      )
    );

    const contentTypeCondition =
      input.contentTypes && input.contentTypes.length > 0
        ? inArray(knowledgeUnitsTable.contentType, input.contentTypes)
        : undefined;

    const ftsCondition = sql`
      to_tsvector('english',
        coalesce(${knowledgeUnitsTable.text}, '')
          || ' ' || coalesce(${knowledgeUnitsTable.summary}, '')
          || ' ' || coalesce(${knowledgeUnitsTable.sectionPath}, '')
      )
      @@ to_tsquery('english', ${tsQuery})
    `;

    const rankExpr = sql<number>`ts_rank_cd(
      to_tsvector('english',
        coalesce(${knowledgeUnitsTable.text}, '')
          || ' ' || coalesce(${knowledgeUnitsTable.summary}, '')
          || ' ' || coalesce(${knowledgeUnitsTable.sectionPath}, '')
      ),
      to_tsquery('english', ${tsQuery})
    )`;

    const rows = await this.drizzle.db
      .select()
      .from(knowledgeUnitsTable)
      .where(
        and(
          eq(knowledgeUnitsTable.status, 'published'),
          scopeConditions,
          activeDateCondition,
          contentTypeCondition,
          ftsCondition
        )
      )
      .orderBy(
        desc(rankExpr),
        desc(sql<number>`length(${knowledgeUnitsTable.summary})`),
        desc(knowledgeUnitsTable.updatedAt)
      )
      .limit(limit);

    return rows;
  }

  async searchUnitsByVector(input: {
    embeddingVector: number[];
    advisorId?: string;
    contentTypes?: string[];
    limit?: number;
  }): Promise<KnowledgeUnit[]> {
    const limit = input.limit ?? 6;
    const overFetch = Math.max(limit * 10, 50);
    const now = new Date();
    const vectorParam = JSON.stringify(input.embeddingVector);

    return this.drizzle.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = strict_order`);

      const contentTypeFilter =
        input.contentTypes && input.contentTypes.length > 0
          ? sql`AND ke.content_type = ANY(${input.contentTypes})`
          : sql``;

      const globalSubQuery = sql`
        SELECT * FROM (
          SELECT ke.unit_id,
                 ke.embedding <=> (${vectorParam})::vector AS distance
          FROM knowledge_embeddings ke
          WHERE ke.embedding IS NOT NULL
            AND ke.status = 'published'
            AND ke.advisor_scope = 'global'
            ${contentTypeFilter}
          ORDER BY distance
          LIMIT ${overFetch}
        ) global_branch
      `;

      const advisorSubQuery = input.advisorId
        ? sql`
          SELECT * FROM (
            SELECT ke.unit_id,
                   ke.embedding <=> (${vectorParam})::vector AS distance
            FROM knowledge_embeddings ke
            WHERE ke.embedding IS NOT NULL
              AND ke.status = 'published'
              AND ke.advisor_scope = ${input.advisorId}
              ${contentTypeFilter}
            ORDER BY distance
            LIMIT ${overFetch}
          ) advisor_branch
        `
        : null;

      const unionCte = advisorSubQuery
        ? sql`${globalSubQuery} UNION ALL ${advisorSubQuery}`
        : globalSubQuery;

      type RawRow = {
        id: string;
        source_id: string;
        source_revision: string;
        section_path: string;
        content_type: string;
        advisor_scope: string;
        audience: string;
        status: string;
        text: string;
        summary: string | null;
        content_hash: string;
        effective_from: string | null;
        effective_to: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
        updated_at: string;
        distance: number;
      };

      const rows = await tx.execute<RawRow>(
        sql`
          WITH candidates AS MATERIALIZED (
            ${unionCte}
          )
          SELECT ku.id,
                 ku.source_id,
                 ku.source_revision,
                 ku.section_path,
                 ku.content_type,
                 ku.advisor_scope,
                 ku.audience,
                 ku.status,
                 ku.text,
                 ku.summary,
                 ku.content_hash,
                 ku.effective_from,
                 ku.effective_to,
                 ku.metadata,
                 ku.created_at,
                 ku.updated_at,
                 c.distance
          FROM candidates c
          JOIN knowledge_units ku ON ku.id = c.unit_id
          WHERE c.distance < 0.3
            AND ku.status = 'published'
            AND (ku.effective_from IS NULL OR ku.effective_from < ${now.toISOString()}::timestamptz)
            AND (ku.effective_to IS NULL OR ku.effective_to > ${now.toISOString()}::timestamptz)
          ORDER BY c.distance
          LIMIT ${limit}
        `
      );

      return rows.map(
        (row): KnowledgeUnit => ({
          id: row.id,
          sourceId: row.source_id,
          sourceRevision: row.source_revision,
          sectionPath: row.section_path,
          contentType: row.content_type,
          advisorScope: row.advisor_scope,
          audience: row.audience,
          status: row.status,
          text: row.text,
          summary: row.summary,
          contentHash: row.content_hash,
          effectiveFrom: row.effective_from
            ? new Date(row.effective_from)
            : null,
          effectiveTo: row.effective_to ? new Date(row.effective_to) : null,
          metadata: row.metadata ?? {},
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        })
      );
    });
  }

  async findPublishedRules(input: {
    query: string;
    limit?: number;
  }): Promise<KnowledgeRule[]> {
    const now = new Date();
    const tsQuery = this.buildTsQuery(input.query);
    if (!tsQuery) return [];

    const ftsCondition = sql`
      to_tsvector('english',
        coalesce(${knowledgeRulesTable.topic}, '')
          || ' ' || coalesce(${knowledgeRulesTable.canonicalAnswer}, '')
      )
      @@ to_tsquery('english', ${tsQuery})
    `;

    const rankExpr = sql<number>`ts_rank_cd(
      to_tsvector('english',
        coalesce(${knowledgeRulesTable.topic}, '')
          || ' ' || coalesce(${knowledgeRulesTable.canonicalAnswer}, '')
      ),
      to_tsquery('english', ${tsQuery})
    )`;

    const rows = await this.drizzle.db
      .select()
      .from(knowledgeRulesTable)
      .where(
        and(
          eq(knowledgeRulesTable.status, 'published'),
          ftsCondition,
          or(
            isNull(knowledgeRulesTable.effectiveFrom),
            lt(knowledgeRulesTable.effectiveFrom, now)
          ),
          or(
            isNull(knowledgeRulesTable.effectiveTo),
            gt(knowledgeRulesTable.effectiveTo, now)
          )
        )
      )
      .orderBy(
        desc(rankExpr),
        desc(knowledgeRulesTable.priority),
        desc(knowledgeRulesTable.updatedAt)
      )
      .limit(input.limit ?? 3);

    return rows;
  }

  private buildTsQuery(query: string): string {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .map((t) => t.replace(/[^\w-]/g, ''))
      .filter((t) => t.length >= 3)
      .slice(0, 8);

    if (terms.length === 0) return '';
    return terms.map((t) => `${t}:*`).join(' | ');
  }

  async createAuditRows(rows: CreateKnowledgeAuditInput[]) {
    if (rows.length === 0) return [];

    return this.drizzle.db
      .insert(messageKnowledgeAuditTable)
      .values(rows)
      .returning();
  }
}
