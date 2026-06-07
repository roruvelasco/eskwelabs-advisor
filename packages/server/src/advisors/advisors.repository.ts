import { eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { advisorsTable, type Advisor } from './advisors.schema';

export class AdvisorsRepository extends Repository {
  async list(): Promise<Advisor[]> {
    return this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(eq(advisorsTable.isActive, true));
  }

  async findActive(id: string): Promise<Advisor | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(advisorsTable)
      .where(eq(advisorsTable.id, id))
      .limit(1);

    const advisor = rows[0];
    if (!advisor?.isActive) return undefined;
    return advisor;
  }
}
