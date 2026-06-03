import { apiClient } from '@/lib/api/client';

export function listAdvisors() {
  return apiClient.advisors.$get().then((response) => response.json());
}
