import { apiClient } from '@/lib/api/client';

export function listConversations(advisorId?: string) {
  return apiClient.conversations
    .$get({
      query: advisorId ? { advisorId } : {}
    })
    .then((response) => response.json());
}

export function getConversation(id: string) {
  return apiClient.conversations[':id']
    .$get({
      param: { id }
    })
    .then((response) => response.json());
}

export function createConversation(input: {
  advisorId: string;
  title?: string;
}) {
  return apiClient.conversations
    .$post({
      json: input
    })
    .then((response) => response.json());
}
