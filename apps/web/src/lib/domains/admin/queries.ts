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

export const usageCountersQuery = queryOptions({
  queryKey: ['admin', 'usage-counters'],
  queryFn: listUsageCounters
});

export const modelConfigQuery = queryOptions({
  queryKey: ['admin', 'model-config'],
  queryFn: listModelConfig
});

export const promptCacheQuery = queryOptions({
  queryKey: ['admin', 'prompt-cache'],
  queryFn: listPromptCache
});

export const telemetryQuery = queryOptions({
  queryKey: ['admin', 'telemetry'],
  queryFn: listTelemetry
});

export const usersQuery = queryOptions({
  queryKey: ['admin', 'users'],
  queryFn: listUsers
});
