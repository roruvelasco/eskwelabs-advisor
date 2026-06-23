import { apiClient } from '@/lib/api/client';
import { parseApiResponse, queryParams } from '@/lib/api/api-error';

type ModelConfigUpdateInput = {
  provider: string;
  model: string;
  isEnabled?: boolean;
};
type CreateUserInput = { email: string; role: 'eif' | 'admin' };
type UpdateUserInput = { role?: 'eif' | 'admin'; isActive?: boolean };

interface DataResponse<T> {
  data: T;
}

export type RefreshStatus = 'skipped' | 'partial' | 'refreshed';

export interface PaginatedData<T> {
  data: T[];
  meta: { nextCursor: string | null; limit: number };
}

export function getAdminUsage(): Promise<DataResponse<unknown>> {
  return apiClient.admin.usage.$get().then(parseApiResponse) as Promise<
    DataResponse<unknown>
  >;
}

export function listUsageCounters({
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
} = {}): Promise<PaginatedData<unknown>> {
  return apiClient.admin['usage-counters']
    .$get({
      query: queryParams({ userId, dayPh, fromDayPh, toDayPh, limit, cursor })
    })
    .then(parseApiResponse) as Promise<PaginatedData<unknown>>;
}

export function listModelConfig(): Promise<DataResponse<unknown[]>> {
  return apiClient.admin['model-config']
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function updateModelConfig(
  advisorId: string,
  input: ModelConfigUpdateInput
): Promise<DataResponse<unknown>> {
  const update = apiClient.admin['model-config'][':advisorId'].$put as (input: {
    param: { advisorId: string };
    json: ModelConfigUpdateInput;
  }) => Promise<Response>;

  return update({
    param: { advisorId },
    json: input
  }).then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function refreshPromptCache(): Promise<
  DataResponse<{ status: RefreshStatus }>
> {
  return apiClient.admin['prompt-cache'].refresh
    .$post()
    .then(parseApiResponse) as Promise<DataResponse<{ status: RefreshStatus }>>;
}

export function listPromptCache({
  limit,
  cursor
}: {
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedData<unknown>> {
  return apiClient.admin['prompt-cache']
    .$get({ query: queryParams({ limit, cursor }) })
    .then(parseApiResponse) as Promise<PaginatedData<unknown>>;
}

export function listTelemetry({
  eventName,
  limit,
  cursor
}: {
  eventName?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedData<unknown>> {
  return apiClient.admin.telemetry
    .$get({ query: queryParams({ eventName, limit, cursor }) })
    .then(parseApiResponse) as Promise<PaginatedData<unknown>>;
}

export function listUsers({
  role,
  search,
  limit,
  cursor
}: {
  role?: 'eif' | 'admin';
  search?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedData<unknown>> {
  return apiClient.admin.users
    .$get({ query: queryParams({ role, search, limit, cursor }) })
    .then(parseApiResponse) as Promise<PaginatedData<unknown>>;
}

export function createUser(
  input: CreateUserInput
): Promise<DataResponse<unknown>> {
  return apiClient.admin.users
    .$post({ json: input })
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

interface UsageLimitsResponse {
  data: {
    config: {
      id: string;
      maxMessagesPerUserPerDay: number;
      maxTokensPerUserPerDay: number;
      dailyBudgetUsd: string;
      monthlyBudgetUsd: string;
      rateLimitWindowSeconds: number;
      rateLimitMaxRequests: number;
      updatedBy: string | null;
      updatedAt: string;
    };
    status: {
      daily: {
        periodKey: string;
        spentUsd: string;
        budgetUsd: string;
        remainingUsd: string;
      };
      monthly: {
        periodKey: string;
        spentUsd: string;
        budgetUsd: string;
        remainingUsd: string;
      };
    } | null;
  };
}

type UpdateUsageLimitsInput = {
  maxMessagesPerUserPerDay: number;
  maxTokensPerUserPerDay: number;
  dailyBudgetUsd: string;
  monthlyBudgetUsd: string;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
};

export function getUsageLimits(): Promise<UsageLimitsResponse> {
  return apiClient.admin['usage-limits']
    .$get()
    .then(parseApiResponse) as Promise<UsageLimitsResponse>;
}

export function updateUsageLimits(
  input: UpdateUsageLimitsInput
): Promise<UsageLimitsResponse> {
  return apiClient.admin['usage-limits']
    .$put({ json: input })
    .then(parseApiResponse) as Promise<UsageLimitsResponse>;
}

export function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<DataResponse<unknown>> {
  const update = apiClient.admin.users[':userId'].$patch as (input: {
    param: { userId: string };
    json: UpdateUserInput;
  }) => Promise<Response>;

  return update({
    param: { userId },
    json: input
  }).then(parseApiResponse) as Promise<DataResponse<unknown>>;
}
