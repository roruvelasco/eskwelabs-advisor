import { apiClient } from '@/lib/api/client';

export function acknowledgeConsent() {
  return apiClient.consent.$post().then((response) => response.json());
}
