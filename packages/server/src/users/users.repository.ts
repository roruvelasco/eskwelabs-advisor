import { and, count, desc, eq, ilike, lt, or } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { decodeCursor, encodeCursor } from '../common/pagination';
import { usersTable, type User } from './users.schema';
import type { ActorRole } from '../common/utils/hono';

export interface PaginatedResult<T> {
  rows: T[];
  nextCursor: string | null;
}

export class UsersRepository extends Repository {
  async list({
    role,
    search,
    limit = 50,
    cursor
  }: {
    role?: ActorRole;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<PaginatedResult<User>> {
    const decoded = cursor ? decodeCursor(cursor) : null;

    const cursorConditions = decoded
      ? or(
          lt(usersTable.createdAt, new Date(decoded.createdAt as string)),
          and(
            eq(usersTable.createdAt, new Date(decoded.createdAt as string)),
            lt(usersTable.id, decoded.id as string)
          )
        )
      : undefined;

    const whereConditions = [
      ...(role ? [eq(usersTable.role, role)] : []),
      ...(search ? [ilike(usersTable.email, `%${search}%`)] : []),
      ...(cursorConditions ? [cursorConditions] : [])
    ];

    const rows = await this.drizzle.db
      .select()
      .from(usersTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(usersTable.createdAt), desc(usersTable.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const resultRows = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
      ? encodeCursor({
          createdAt: resultRows[resultRows.length - 1].createdAt.toISOString(),
          id: resultRows[resultRows.length - 1].id
        })
      : null;

    return { rows: resultRows, nextCursor };
  }

  async count(): Promise<number> {
    const rows = await this.drizzle.db
      .select({ count: count() })
      .from(usersTable);
    return rows[0]?.count ?? 0;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);
    return rows[0];
  }

  async findById(id: string): Promise<User | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return rows[0];
  }

  async createOrReactivate(
    email: string,
    role: 'eif' | 'admin'
  ): Promise<User> {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      const rows = await this.drizzle.db
        .update(usersTable)
        .set({ isActive: true, role })
        .where(eq(usersTable.email, normalizedEmail))
        .returning();
      return rows[0];
    }
    const rows = await this.drizzle.db
      .insert(usersTable)
      .values({ email: normalizedEmail, role })
      .returning();
    return rows[0];
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'role' | 'isActive'>>
  ): Promise<User | undefined> {
    const rows = await this.drizzle.db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning();
    return rows[0];
  }

  async acknowledgeConsent(userId: string): Promise<User | undefined> {
    const rows = await this.drizzle.db
      .update(usersTable)
      .set({ consentAcknowledgedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning();
    return rows[0];
  }
}
