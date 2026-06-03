import { handle } from 'hono/vercel';

import { createServer } from '@eskwelabs-advisor/server';

const { routes } = createServer();

export const GET = handle(routes);
export const POST = handle(routes);
export const PUT = handle(routes);
export const PATCH = handle(routes);
export const DELETE = handle(routes);
