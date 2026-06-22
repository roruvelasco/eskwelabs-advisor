export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'unknown_error',
      body?.error?.message ?? 'Request failed.',
      body
    );
  }

  return body as T;
}

export function queryParams(
  input: Record<string, string | number | undefined | null>
) {
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') {
      query[key] = String(value);
    }
  }

  return query;
}
