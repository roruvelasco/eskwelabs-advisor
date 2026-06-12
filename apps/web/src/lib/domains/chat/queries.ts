import { queryOptions } from '@tanstack/react-query';

import { listMessages } from './api';

export function messagesQueryKey(conversationId: string) {
  return ['messages', conversationId] as const;
}

export function messagesQuery(conversationId: string) {
  return queryOptions({
    queryKey: messagesQueryKey(conversationId),
    queryFn: () => listMessages(conversationId)
  });
}
