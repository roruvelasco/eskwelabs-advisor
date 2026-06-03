import { apiClient } from '@/lib/api/client';

type ModelConfigUpdateInput = { provider: string; model: string };

export function getAdminUsage() {
  return apiClient.admin.usage.$get().then((response) => response.json());
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
  const update = apiClient.admin['model-config'][':advisorId'].$put as (
    input: { param: { advisorId: string }; json: ModelConfigUpdateInput }
  ) => Promise<Response>;

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

export function listTelemetry() {
  return apiClient.admin.telemetry.$get().then((response) => response.json());
}
