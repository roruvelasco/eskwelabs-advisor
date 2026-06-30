import { apiClient } from '@/lib/api/client';
import { parseApiResponse, queryParams } from '@/lib/api/api-error';

type ModelConfigUpdateInput = {
  provider: string;
  model: string;
  isEnabled?: boolean;
};
type UpdateAdvisorPromptSourceInput = { promptDocId: string | null };
type CreateUserInput = { email: string; role: 'eif' | 'admin' };
type UpdateUserInput = { role?: 'eif' | 'admin'; isActive?: boolean };

interface DataResponse<T> {
  data: T;
}

export type RefreshStatus = 'skipped' | 'partial' | 'refreshed';

export interface PromptRefreshResult {
  status: RefreshStatus;
  warmed: {
    advisorPrompts: Array<{
      advisorId: string;
      status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
      revision?: string;
      hash?: string;
      code?: string;
      reason?: string;
    }>;
    dnaDigest: {
      status: 'refreshed' | 'unchanged' | 'failed' | 'skipped';
      revision?: string;
      hash?: string;
      code?: string;
      reason?: string;
    };
  } | null;
}

export interface PaginatedData<T> {
  data: T[];
  meta: { nextCursor: string | null; limit: number };
}

export interface UsageSummaryResponse {
  data: {
    range: {
      fromDayPh: string;
      toDayPh: string;
      timeZone: 'Asia/Manila';
    };
    totals: {
      messages: number;
      tokens: number;
      estimatedSpendUsd: string;
      activeUsers: number;
    };
    days: Array<{
      dayPh: string;
      messages: number;
      tokens: number;
      estimatedSpendUsd: string;
    }>;
    topUsers: Array<{
      userId: string;
      userEmail?: string;
      messages: number;
      tokens: number;
      estimatedSpendUsd: string;
    }>;
  };
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

export function getUsageSummary({
  fromDayPh,
  toDayPh,
  userId,
  topUsersLimit
}: {
  fromDayPh?: string;
  toDayPh?: string;
  userId?: string;
  topUsersLimit?: number;
} = {}): Promise<UsageSummaryResponse> {
  return apiClient.admin['usage-counters'].summary
    .$get({ query: queryParams({ fromDayPh, toDayPh, userId, topUsersLimit }) })
    .then(parseApiResponse) as Promise<UsageSummaryResponse>;
}

export function listModelConfig(): Promise<DataResponse<unknown[]>> {
  return apiClient.admin['model-config']
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function listAdvisorPromptSources(): Promise<DataResponse<unknown[]>> {
  return apiClient.admin.advisors['prompt-sources']
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function updateAdvisorPromptSource(
  advisorId: string,
  input: UpdateAdvisorPromptSourceInput
): Promise<DataResponse<unknown>> {
  const update = apiClient.admin.advisors[':advisorId']['prompt-source']
    .$patch as (input: {
    param: { advisorId: string };
    json: UpdateAdvisorPromptSourceInput;
  }) => Promise<Response>;

  return update({
    param: { advisorId },
    json: input
  }).then(parseApiResponse) as Promise<DataResponse<unknown>>;
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
  DataResponse<PromptRefreshResult>
> {
  return apiClient.admin['prompt-cache'].refresh
    .$post()
    .then(parseApiResponse) as Promise<DataResponse<PromptRefreshResult>>;
}

export function getPromptHealth(): Promise<DataResponse<unknown>> {
  return apiClient.admin['prompt-cache'].health
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function getDnaSource(): Promise<DataResponse<unknown>> {
  return apiClient.admin['prompt-cache']['dna-source']
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function updateDnaSource(input: {
  docId: string;
}): Promise<DataResponse<unknown>> {
  return apiClient.admin['prompt-cache']['dna-source']
    .$put({ json: input })
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function listAdvisorSnapshots(
  advisorId: string
): Promise<DataResponse<unknown[]>> {
  return apiClient.admin['prompt-cache'].advisors[':advisorId'].snapshots
    .$get({ param: { advisorId } })
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function activateAdvisorSnapshot(
  advisorId: string,
  snapshotId: string
): Promise<DataResponse<unknown>> {
  return apiClient.admin['prompt-cache'].advisors[':advisorId'].snapshots[
    ':snapshotId'
  ].activate
    .$post({ param: { advisorId, snapshotId } })
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function listDnaDigests(): Promise<DataResponse<unknown[]>> {
  return apiClient.admin['prompt-cache']['dna-digests']
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function activateDnaDigest(
  digestId: string
): Promise<DataResponse<unknown>> {
  return apiClient.admin['prompt-cache']['dna-digests'][':digestId'].activate
    .$post({ param: { digestId } })
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
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

interface CreateKnowledgeSourceInput {
  sourceType: string;
  externalId: string;
  title: string;
  advisorScope: string;
  contentType: string;
  audience: 'advisor' | 'eif';
  url?: string;
  owner?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateKnowledgeSourceInput {
  externalId?: string;
  title?: string;
  url?: string | null;
  owner?: string | null;
  status?: string;
  audience?: 'advisor' | 'eif';
  advisorScope?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export function listKnowledgeSources({
  limit,
  cursor,
  status,
  advisorScope
}: {
  limit?: number;
  cursor?: string;
  status?: string;
  advisorScope?: string;
} = {}): Promise<PaginatedData<unknown>> {
  return apiClient.admin.knowledge.sources
    .$get({ query: queryParams({ limit, cursor, status, advisorScope }) })
    .then(parseApiResponse) as Promise<PaginatedData<unknown>>;
}

export function createKnowledgeSource(
  input: CreateKnowledgeSourceInput
): Promise<DataResponse<unknown>> {
  return apiClient.admin.knowledge.sources
    .$post({ json: input as unknown as Record<string, unknown> })
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function updateKnowledgeSource(
  sourceId: string,
  input: UpdateKnowledgeSourceInput
): Promise<DataResponse<unknown>> {
  const update = apiClient.admin.knowledge.sources[':sourceId']
    .$patch as (input: {
    param: { sourceId: string };
    json: UpdateKnowledgeSourceInput;
  }) => Promise<Response>;

  return update({
    param: { sourceId },
    json: input
  }).then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function refreshKnowledgeSource(
  sourceId: string
): Promise<DataResponse<unknown>> {
  const refresh = apiClient.admin.knowledge.sources[':sourceId'].refresh
    .$post as (input: { param: { sourceId: string } }) => Promise<Response>;

  return refresh({ param: { sourceId } }).then(parseApiResponse) as Promise<
    DataResponse<unknown>
  >;
}

export function refreshAllKnowledgeSources(): Promise<DataResponse<unknown>> {
  return apiClient.admin.knowledge.refresh
    .$post()
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function listKnowledgeUnits(
  sourceId: string
): Promise<DataResponse<unknown[]>> {
  return apiClient.admin.knowledge.sources[':sourceId'].units
    .$get({ param: { sourceId } })
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}

export function getKnowledgeHealth(): Promise<DataResponse<unknown>> {
  return apiClient.admin.knowledge.health
    .$get()
    .then(parseApiResponse) as Promise<DataResponse<unknown>>;
}

export function searchKnowledge({
  query,
  advisorId,
  limit
}: {
  query: string;
  advisorId?: string;
  limit?: number;
}): Promise<DataResponse<unknown[]>> {
  return apiClient.admin.knowledge.search
    .$get({ query: queryParams({ query, advisorId, limit }) })
    .then(parseApiResponse) as Promise<DataResponse<unknown[]>>;
}
