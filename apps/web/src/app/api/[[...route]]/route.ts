import { handle } from 'hono/vercel';

import { createServer } from '@eskwelabs-advisor/server';
import { VercelDeferredTaskRunner } from '@/lib/server/vercel-deferred-task-runner';

const isVercel = process.env.VERCEL === '1';

const { routes } = createServer(
  isVercel ? { deferredTaskRunner: new VercelDeferredTaskRunner() } : undefined
);

export const GET = handle(routes);
export const POST = handle(routes);
export const PUT = handle(routes);
export const PATCH = handle(routes);
export const DELETE = handle(routes);
