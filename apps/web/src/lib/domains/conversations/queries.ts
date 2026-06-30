import { queryOptions } from '@tanstack/react-query';

import { getConversation, listConversations } from './api';

export function conversationsQuery({
  advisorId,
  search,
  limit,
  cursor
}: {
  advisorId?: string;
  search?: string;
  limit?: number;
  cursor?: string;
} = {}) {
  return queryOptions({
    queryKey: ['conversations', advisorId, search, limit, cursor],
    queryFn: () => listConversations({ advisorId, search, limit, cursor }),
    staleTime: 30_000
  });
}

export function conversationQuery(id: string) {
  return queryOptions({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id)
  });
}
