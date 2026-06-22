import { dataResponse } from '../common/pagination';

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
      availability?: {
        status: 'available' | 'unavailable';
        reasons?: string[];
      };
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
}
