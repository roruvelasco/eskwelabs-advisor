import { queryOptions } from '@tanstack/react-query';

import {
  getConversation,
  getSharedConversation,
  listConversations
} from './api';

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

export function sharedConversationQuery(shareId: string) {
  return queryOptions({
    queryKey: ['shared-conversation', shareId],
    queryFn: () => getSharedConversation(shareId),
    retry: false
  });
}
