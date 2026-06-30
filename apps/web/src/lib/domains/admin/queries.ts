import { queryOptions } from '@tanstack/react-query';

import {
  getAdminUsage,
  getDnaSource,
  getUsageLimits,
  getUsageSummary,
  getKnowledgeHealth,
  listAdvisorPromptSources,
  listKnowledgeSources,
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

export const usageLimitsQuery = queryOptions({
  queryKey: ['admin', 'usage-limits'],
  queryFn: getUsageLimits
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

export function usageSummaryQuery({
  fromDayPh,
  toDayPh,
  userId,
  topUsersLimit
}: {
  fromDayPh?: string;
  toDayPh?: string;
  userId?: string;
  topUsersLimit?: number;
} = {}) {
  return queryOptions({
    queryKey: [
      'admin',
      'usage-counters',
      'summary',
      fromDayPh,
      toDayPh,
      userId,
      topUsersLimit
    ],
    queryFn: () =>
      getUsageSummary({ fromDayPh, toDayPh, userId, topUsersLimit })
  });
}

export const modelConfigQuery = queryOptions({
  queryKey: ['admin', 'model-config'],
  queryFn: listModelConfig
});

export const advisorPromptSourcesQuery = queryOptions({
  queryKey: ['admin', 'advisor-prompt-sources'],
  queryFn: listAdvisorPromptSources
});

export const dnaSourceQuery = queryOptions({
  queryKey: ['admin', 'dna-source'],
  queryFn: getDnaSource
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

export function knowledgeSourcesQuery({
  limit,
  cursor,
  status,
  advisorScope
}: {
  limit?: number;
  cursor?: string;
  status?: string;
  advisorScope?: string;
} = {}) {
  return queryOptions({
    queryKey: [
      'admin',
      'knowledge-sources',
      limit,
      cursor,
      status,
      advisorScope
    ],
    queryFn: () => listKnowledgeSources({ limit, cursor, status, advisorScope })
  });
}

export const knowledgeHealthQuery = queryOptions({
  queryKey: ['admin', 'knowledge-health'],
  queryFn: getKnowledgeHealth
});
