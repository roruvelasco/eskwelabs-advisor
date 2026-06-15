import { z } from 'zod';

export const paginationParamsDto = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export type PaginationParams = z.infer<typeof paginationParamsDto>;

export function encodeCursor(tuple: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(tuple)).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8')
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    limit: number;
  };
}

export function paginatedResponse<T>(
  rows: T[],
  limit: number,
  nextCursor: string | null
): PaginatedResponse<T> {
  return {
    data: rows,
    meta: { nextCursor, limit }
  };
}
