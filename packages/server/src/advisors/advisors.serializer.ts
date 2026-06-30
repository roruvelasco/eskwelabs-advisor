import { dataResponse, paginatedResponse } from '../common/pagination';

type AdvisorAvailability = {
  status: 'available' | 'unavailable';
  reasons?: string[];
};

type AdvisorAdminRow = {
  id: string;
  name: string;
  description: string;
  promptDocId: string | null;
  isActive: boolean;
  status: string;
  activeRuntimeVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  modelConfig?: {
    advisorId: string;
    provider: string;
    model: string;
    isEnabled: boolean;
    updatedBy: string | null;
    updatedAt: Date;
  } | null;
  availability?: AdvisorAvailability;
};

export class AdvisorsSerializer {
  list(
    rows: Array<{
      id: string;
      name: string;
      description: string;
      isActive: boolean;
      status: string;
      activeRuntimeVersionId: string | null;
      createdAt: Date;
      availability?: AdvisorAvailability;
    }>
  ) {
    return dataResponse(
      rows.map(
        ({
          id,
          name,
          description,
          isActive,
          status,
          activeRuntimeVersionId,
          createdAt,
          availability
        }) => ({
          id,
          name,
          description,
          isActive,
          status,
          activeRuntimeVersionId,
          createdAt,
          availability
        })
      )
    );
  }

  adminList(rows: AdvisorAdminRow[], limit: number, nextCursor: string | null) {
    return paginatedResponse(
      rows.map((row) => this.adminAdvisor(row)),
      limit,
      nextCursor
    );
  }

  adminSingle(row: AdvisorAdminRow) {
    return dataResponse(this.adminAdvisor(row));
  }

  runtimeVersion(row: {
    id: string;
    advisorId: string;
    promptSnapshotId: string | null;
    dnaDigestId: string | null;
    modelConfigAdvisorId: string;
    versionNumber: number;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
  }) {
    return dataResponse({
      id: row.id,
      advisorId: row.advisorId,
      promptSnapshotId: row.promptSnapshotId,
      dnaDigestId: row.dnaDigestId,
      modelConfigAdvisorId: row.modelConfigAdvisorId,
      versionNumber: row.versionNumber,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt
    });
  }

  private adminAdvisor(row: AdvisorAdminRow) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      promptDocId: row.promptDocId,
      isActive: row.isActive,
      status: row.status,
      activeRuntimeVersionId: row.activeRuntimeVersionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      modelConfig: row.modelConfig
        ? {
            advisorId: row.modelConfig.advisorId,
            provider: row.modelConfig.provider,
            model: row.modelConfig.model,
            isEnabled: row.modelConfig.isEnabled,
            updatedBy: row.modelConfig.updatedBy,
            updatedAt: row.modelConfig.updatedAt
          }
        : null,
      availability: row.availability
    };
  }

  promptSources(
    rows: Array<{
      id: string;
      name: string;
      description: string;
      promptDocId: string | null;
      isActive: boolean;
      status: string;
      updatedAt: Date;
    }>
  ) {
    return dataResponse(
      rows.map((row) => ({
        advisorId: row.id,
        name: row.name,
        description: row.description,
        promptDocId: row.promptDocId,
        isActive: row.isActive,
        status: row.status,
        updatedAt: row.updatedAt
      }))
    );
  }
}
