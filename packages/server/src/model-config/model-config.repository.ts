import { Repository } from '../common/factories/repository.factory';

interface ModelConfigRow {
  advisorId: string;
  provider: string;
  model: string;
  isEnabled: boolean;
  updatedBy?: string;
  updatedAt: string;
}

const rows = new Map<string, ModelConfigRow>(
  [
    'data-dashboard',
    'ssot-memo',
    'advisor-3'
  ].map((advisorId) => [
    advisorId,
    {
      advisorId,
      provider: 'deterministic',
      model: 'deterministic-model',
      isEnabled: true,
      updatedAt: new Date(0).toISOString()
    }
  ])
);

export class ModelConfigRepository extends Repository {
  async list() {
    return [...rows.values()];
  }

  async find(advisorId: string) {
    return rows.get(advisorId) ?? null;
  }

  async upsert(
    advisorId: string,
    input: { provider: string; model: string; updatedBy: string; isEnabled?: boolean }
  ) {
    const row = {
      advisorId,
      provider: input.provider,
      model: input.model,
      isEnabled: input.isEnabled ?? true,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString()
    };
    rows.set(advisorId, row);
    return row;
  }
}
