export class AdvisorsSerializer {
  list(
    rows: Array<{
      id: string;
      name: string;
      description?: string;
      isActive?: boolean;
      createdAt?: Date | string;
    }>
  ) {
    return {
      data: rows.map(({ id, name, description, isActive, createdAt }) => ({
        id,
        name,
        description,
        isActive,
        createdAt
      }))
    };
  }
}
