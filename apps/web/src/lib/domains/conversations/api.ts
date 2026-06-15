import { apiClient } from '@/lib/api/client';

export function listConversations({
  advisorId,
  limit,
  cursor
}: {
  advisorId?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  const query: Record<string, string> = {};
  if (advisorId) query.advisorId = advisorId;
  if (limit !== undefined) query.limit = String(limit);
  if (cursor) query.cursor = cursor;

  return apiClient.conversations
    .$get({
      query
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

export function deleteConversation(id: string) {
  return apiClient.conversations[':id'].$delete({
    param: { id }
  });
}
