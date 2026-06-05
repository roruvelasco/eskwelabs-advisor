import { queryOptions } from '@tanstack/react-query';

import {
  getAdminUsage,
  listModelConfig,
  listTelemetry,
  listUsers
} from './api';

export const adminUsageQuery = queryOptions({
  queryKey: ['admin', 'usage'],
  queryFn: getAdminUsage
});

export const modelConfigQuery = queryOptions({
  queryKey: ['admin', 'model-config'],
  queryFn: listModelConfig
});

export const telemetryQuery = queryOptions({
  queryKey: ['admin', 'telemetry'],
  queryFn: listTelemetry
});

export const usersQuery = queryOptions({
  queryKey: ['admin', 'users'],
  queryFn: listUsers
});
