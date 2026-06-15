import { apiClient } from '@/lib/api/client';

type ModelConfigUpdateInput = {
  provider: string;
  model: string;
  isEnabled?: boolean;
};
type CreateUserInput = { email: string; role: 'eif' | 'admin' };
type UpdateUserInput = { role?: 'eif' | 'admin'; isActive?: boolean };

export function getAdminUsage() {
  return apiClient.admin.usage.$get().then((response) => response.json());
}

export function listUsageCounters({
  userId,
  dayPh,
  limit,
  cursor
}: {
  userId?: string;
  dayPh?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  const query: Record<string, string> = {};
  if (userId) query.userId = userId;
  if (dayPh) query.dayPh = dayPh;
  if (limit !== undefined) query.limit = String(limit);
  if (cursor) query.cursor = cursor;

  return apiClient.admin['usage-counters']
    .$get({ query })
    .then((response) => response.json());
}

export function listModelConfig() {
  return apiClient.admin['model-config']
    .$get()
    .then((response) => response.json());
}

export function updateModelConfig(
  advisorId: string,
  input: ModelConfigUpdateInput
) {
  const update = apiClient.admin['model-config'][':advisorId'].$put as (input: {
    param: { advisorId: string };
    json: ModelConfigUpdateInput;
  }) => Promise<Response>;

  return update({
    param: { advisorId },
    json: input
  }).then((response) => response.json());
}

export function refreshPromptCache() {
  return apiClient.admin['prompt-cache'].refresh
    .$post()
    .then((response) => response.json());
}

export function listPromptCache({
  limit,
  cursor
}: {
  limit?: number;
  cursor?: string;
} = {}) {
  const query: Record<string, string> = {};
  if (limit !== undefined) query.limit = String(limit);
  if (cursor) query.cursor = cursor;

  return apiClient.admin['prompt-cache']
    .$get({ query })
    .then((response) => response.json());
}

export function listTelemetry({
  eventName,
  limit,
  cursor
}: {
  eventName?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  const query: Record<string, string> = {};
  if (eventName) query.eventName = eventName;
  if (limit !== undefined) query.limit = String(limit);
  if (cursor) query.cursor = cursor;

  return apiClient.admin.telemetry
    .$get({ query })
    .then((response) => response.json());
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
} = {}) {
  const query: Record<string, string> = {};
  if (role) query.role = role;
  if (search) query.search = search;
  if (limit !== undefined) query.limit = String(limit);
  if (cursor) query.cursor = cursor;

  return apiClient.admin.users
    .$get({ query })
    .then((response) => response.json());
}

export function createUser(input: CreateUserInput) {
  return apiClient.admin.users
    .$post({ json: input })
    .then((response) => response.json());
}

export function updateUser(userId: string, input: UpdateUserInput) {
  const update = apiClient.admin.users[':userId'].$patch as (input: {
    param: { userId: string };
    json: UpdateUserInput;
  }) => Promise<Response>;

  return update({
    param: { userId },
    json: input
  }).then((response) => response.json());
}
