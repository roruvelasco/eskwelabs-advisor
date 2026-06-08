import { apiClient } from '@/lib/api/client';

export function getConsent() {
  return apiClient.consent.$get().then((response) => response.json());
}

export function acknowledgeConsent() {
  return apiClient.consent.$post().then((response) => response.json());
}
