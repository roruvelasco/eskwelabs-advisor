import { eq } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { modelConfigTable, type ModelConfig } from './model-config.schema';

export class ModelConfigRepository extends Repository {
  async list(): Promise<ModelConfig[]> {
    return this.drizzle.db.select().from(modelConfigTable);
  }

  async find(advisorId: string): Promise<ModelConfig | undefined> {
    const rows = await this.drizzle.db
      .select()
      .from(modelConfigTable)
      .where(eq(modelConfigTable.advisorId, advisorId))
      .limit(1);
    return rows[0];
  }

  async upsert(
    advisorId: string,
    input: {
      provider: string;
      model: string;
      updatedBy: string;
      isEnabled?: boolean;
    }
  ): Promise<ModelConfig> {
    const rows = await this.drizzle.db
      .insert(modelConfigTable)
      .values({
        advisorId,
        provider: input.provider,
        model: input.model,
        isEnabled: input.isEnabled ?? true,
        updatedBy: input.updatedBy,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: modelConfigTable.advisorId,
        set: {
          provider: input.provider,
          model: input.model,
          isEnabled: input.isEnabled ?? true,
          updatedBy: input.updatedBy,
          updatedAt: new Date()
        }
      })
      .returning();

    return rows[0];
  }
}
