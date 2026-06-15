import { queryOptions } from '@tanstack/react-query';

import { getConversation, listConversations } from './api';

export function conversationsQuery({
  advisorId,
  limit,
  cursor
}: {
  advisorId?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: ['conversations', advisorId, limit, cursor],
    queryFn: () => listConversations({ advisorId, limit, cursor }),
    staleTime: 30_000
  });
}

export function conversationQuery(id: string) {
  return queryOptions({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id)
  });
}
