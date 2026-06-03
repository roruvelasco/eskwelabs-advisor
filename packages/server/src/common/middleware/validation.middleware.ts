import type { Context } from 'hono';
import type { z } from 'zod';

import { validationFailed } from '../http/http-exception';

export async function parseJsonBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T
): Promise<z.infer<T>> {
  const body = await c.req.json().catch(() => undefined);
  const result = schema.safeParse(body);

  if (!result.success) {
    throw validationFailed({ issues: result.error.issues });
  }

  return result.data;
}
