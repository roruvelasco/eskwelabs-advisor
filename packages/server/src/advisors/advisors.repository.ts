import { and, desc, eq, ilike, lt, or } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import {
  decodeCursor,
  paginateResult,
  type PaginatedResult
} from '../common/pagination';
import { advisorsTable, type Advisor } from './advisors.schema';

type AdvisorListFilters = {
  status?: string;
  search?: string;
  isActive?: boolean;
  limit?: number;
  cursor?: string;
};

type CreateAdvisorInput = {
  id: string;
  name: string;
  description?: string;
  promptDocId?: string | null;
  isActive?: boolean;
  status?: string;
};

type UpdateAdvisorInput = Partial<
  Pick<Advisor, 'name' | 'description' | 'promptDocId' | 'isActive' | 'status'>
>;

export class AdvisorsRepository extends Repository {
  async list(): Promise<Advisor[]> {
    return this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(
        and(
          eq(advisorsTable.isActive, true),
          eq(advisorsTable.status, 'active')
        )
      );
  }

  async listForAdmin({
    status,
    search,
    isActive,
    limit = 50,
    cursor
  }: AdvisorListFilters = {}): Promise<PaginatedResult<Advisor>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(advisorsTable.createdAt, new Date(decoded.createdAt as string)),
          and(
            eq(advisorsTable.createdAt, new Date(decoded.createdAt as string)),
            lt(advisorsTable.id, decoded.id as string)
          )
        )
      : undefined;

    const whereConditions = [
      ...(status ? [eq(advisorsTable.status, status)] : []),
      ...(typeof isActive === 'boolean'
        ? [eq(advisorsTable.isActive, isActive)]
        : []),
      ...(search
        ? [
            or(
              ilike(advisorsTable.id, `%${search}%`),
              ilike(advisorsTable.name, `%${search}%`)
            )
          ]
        : []),
      ...(cursorConditions ? [cursorConditions] : [])
    ];

    const rows = await this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(advisorsTable.createdAt), desc(advisorsTable.id))
      .limit(limit + 1);

    return paginateResult(rows, limit, (last) => ({
      createdAt: last.createdAt.toISOString(),
      id: last.id
    }));
  }

  async findById(id: string): Promise<Advisor | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(eq(advisorsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(input: CreateAdvisorInput): Promise<Advisor> {
    const rows = await this.drizzle.db
      .insert(advisorsTable)
      .values({
        id: input.id,
        name: input.name,
        description: input.description ?? '',
        promptDocId: input.promptDocId,
        isActive: input.isActive ?? true,
        status: input.status ?? 'active'
      })
      .returning();

    return rows[0];
  }

  async update(
    advisorId: string,
    input: UpdateAdvisorInput
  ): Promise<Advisor | undefined> {
    const rows = await this.drizzle.db
      .update(advisorsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(advisorsTable.id, advisorId))
      .returning();

    return rows[0];
  }

  async softDisable(advisorId: string): Promise<Advisor | undefined> {
    const rows = await this.drizzle.db
      .update(advisorsTable)
      .set({
        isActive: false,
        status: 'disabled',
        activeRuntimeVersionId: null,
        updatedAt: new Date()
      })
      .where(eq(advisorsTable.id, advisorId))
      .returning();

    return rows[0];
  }

  async findActive(id: string): Promise<Advisor | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(and(eq(advisorsTable.id, id), eq(advisorsTable.status, 'active')))
      .limit(1);

    const advisor = rows[0];
    if (!advisor?.isActive) return undefined;
    return advisor;
  }

  async updatePromptDocId(advisorId: string, promptDocId: string | null) {
    const rows = await this.drizzle.db
      .update(advisorsTable)
      .set({ promptDocId, updatedAt: new Date() })
      .where(eq(advisorsTable.id, advisorId))
      .returning();

    return rows[0];
  }
}
