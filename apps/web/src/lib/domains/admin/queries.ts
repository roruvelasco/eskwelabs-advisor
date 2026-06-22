import { queryOptions } from '@tanstack/react-query';

import {
  getAdminUsage,
  listPromptCache,
  listUsageCounters,
  listModelConfig,
  listTelemetry,
  listUsers
} from './api';

export const adminUsageQuery = queryOptions({
  queryKey: ['admin', 'usage'],
  queryFn: getAdminUsage
});

export function usageCountersQuery({
  userId,
  dayPh,
  fromDayPh,
  toDayPh,
  limit,
  cursor
}: {
  userId?: string;
  dayPh?: string;
  fromDayPh?: string;
  toDayPh?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: [
      'admin',
      'usage-counters',
      userId,
      dayPh,
      fromDayPh,
      toDayPh,
      limit,
      cursor
    ],
    queryFn: () =>
      listUsageCounters({ userId, dayPh, fromDayPh, toDayPh, limit, cursor })
  });
}

export const modelConfigQuery = queryOptions({
  queryKey: ['admin', 'model-config'],
  queryFn: listModelConfig
});

export function promptCacheQuery({
  limit,
  cursor
}: {
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: ['admin', 'prompt-cache', limit, cursor],
    queryFn: () => listPromptCache({ limit, cursor })
  });
}

export function telemetryQuery({
  eventName,
  limit,
  cursor
}: {
  eventName?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: ['admin', 'telemetry', eventName, limit, cursor],
    queryFn: () => listTelemetry({ eventName, limit, cursor })
  });
}

export function usersQuery({
  role,
  search,
  limit,
  cursor
}: {
  role?: 'eif' | 'admin';
  search?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: ['admin', 'users', role, search, limit, cursor],
    queryFn: () => listUsers({ role, search, limit, cursor })
  });
}
