import { queryOptions } from '@tanstack/react-query';

import { getConversation, listConversations } from './api';

export function conversationsQuery(advisorId?: string) {
  return queryOptions({
    queryKey: ['conversations', advisorId],
    queryFn: () => listConversations(advisorId),
    staleTime: 30_000
  });
}

export function conversationQuery(id: string) {
  return queryOptions({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id)
  });
}
