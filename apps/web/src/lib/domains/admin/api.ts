import { apiClient } from '@/lib/api/client';

type ModelConfigUpdateInput = { provider: string; model: string };
type CreateUserInput = { email: string; role: 'eif' | 'admin' };
type UpdateUserInput = { role?: 'eif' | 'admin'; isActive?: boolean };

export function getAdminUsage() {
  return apiClient.admin.usage.$get().then((response) => response.json());
}

export function listUsageCounters() {
  return apiClient.admin['usage-counters']
    .$get()
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

export function listPromptCache() {
  return apiClient.admin['prompt-cache']
    .$get()
    .then((response) => response.json());
}

export function listTelemetry() {
  return apiClient.admin.telemetry.$get().then((response) => response.json());
}

export function listUsers() {
  return apiClient.admin.users.$get().then((response) => response.json());
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
