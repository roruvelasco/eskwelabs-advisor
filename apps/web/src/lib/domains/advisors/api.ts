import { apiClient } from '@/lib/api/client';
import { parseApiResponse } from '@/lib/api/api-error';

export interface AdvisorData {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  status: string;
  activeRuntimeVersionId: string | null;
  createdAt: string;
  availability?: { status: 'available' | 'unavailable'; reasons?: string[] };
}

export function listAdvisors(): Promise<{ data: AdvisorData[] }> {
  return apiClient.advisors.$get().then(parseApiResponse) as Promise<{
    data: AdvisorData[];
  }>;
}
