import { apiClient } from '@/lib/api/client';
import { parseApiResponse } from '@/lib/api/api-error';

export function getConsent() {
  return apiClient.consent.$get().then(parseApiResponse);
}

export function acknowledgeConsent() {
  return apiClient.consent.$post().then(parseApiResponse);
}
