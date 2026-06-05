import { eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { usersTable, type User } from './users.schema';

export class UsersRepository extends Repository {
  async list(): Promise<User[]> {
    return this.drizzle.db.select().from(usersTable);
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
