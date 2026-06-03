import { queryOptions } from '@tanstack/react-query';

import { listMessages } from './api';

export function messagesQuery(conversationId: string) {
  return queryOptions({
    queryKey: ['messages', conversationId],
    queryFn: () => listMessages(conversationId)
  });
}
