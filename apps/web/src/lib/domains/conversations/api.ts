import { apiClient } from '@/lib/api/client';
import { parseApiResponse, queryParams } from '@/lib/api/api-error';
import type { PaginatedData } from '../admin/api';

export interface ConversationData {
  id: string;
  userId: string;
  advisorId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function listConversations({
  advisorId,
  search,
  limit,
  cursor
}: {
  advisorId?: string;
  search?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<PaginatedData<ConversationData>> {
  return apiClient.conversations
    .$get({
      query: queryParams({ advisorId, search, limit, cursor })
    })
    .then(parseApiResponse) as Promise<PaginatedData<ConversationData>>;
}

export function getConversation(
  id: string
): Promise<{ data: ConversationData }> {
  return apiClient.conversations[':id']
    .$get({
      param: { id }
    })
    .then(parseApiResponse) as Promise<{ data: ConversationData }>;
}

export function createConversation(input: {
  advisorId: string;
  title?: string;
}): Promise<{ data: ConversationData }> {
  return apiClient.conversations
    .$post({
      json: input
    })
    .then(parseApiResponse) as Promise<{ data: ConversationData }>;
}

export function deleteConversation(id: string) {
  return apiClient.conversations[':id'].$delete({
    param: { id }
  });
}

export interface ConversationShareLinkData {
  shareId: string;
  url: string;
}

export interface SharedMessageData {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface SharedConversationData {
  conversation: {
    title: string;
    advisorName: string;
    createdAt: string;
  };
  messages: SharedMessageData[];
}

export function shareConversation(
  id: string
): Promise<{ data: ConversationShareLinkData }> {
  return apiClient.conversations[':id'].share
    .$post({
      param: { id }
    })
    .then(parseApiResponse) as Promise<{ data: ConversationShareLinkData }>;
}

export function getSharedConversation(
  shareId: string
): Promise<{ data: SharedConversationData }> {
  return apiClient.share[':shareId']
    .$get({
      param: { shareId }
    })
    .then(parseApiResponse) as Promise<{ data: SharedConversationData }>;
}
