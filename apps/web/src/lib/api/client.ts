import { hc } from 'hono/client';

import type { ApiRoutes } from '@eskwelabs-advisor/server';

export const apiClient = hc<ApiRoutes>('/').api;
