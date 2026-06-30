import { apiClient } from '@/lib/api/client';
import { ApiError, parseApiResponse, queryParams } from '@/lib/api/api-error';
import type { PaginatedData } from '../admin/api';

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: string;
  latencyMs?: number;
  status: 'ok' | 'blocked' | 'error' | 'pending' | 'streaming';
  blockReason?: string;
  promptDocRevision?: string;
  dnaDigestVersion?: string;
  createdAt: string;
}

export function listMessages({
  conversationId,
  limit,
  cursor
}: {
  conversationId: string;
  limit?: number;
  cursor?: string;
}): Promise<PaginatedData<Message>> {
  return apiClient.messages
    .$get({ query: queryParams({ conversationId, limit, cursor }) })
    .then(parseApiResponse) as Promise<PaginatedData<Message>>;
}

export function createChatTurn(input: {
  conversationId: string;
  content: string;
  clientTurnId?: string;
}): Promise<{ data: unknown }> {
  return apiClient['chat-turn']
    .$post({
      json: input
    })
    .then(parseApiResponse) as Promise<{ data: unknown }>;
}

export type StreamEvent =
  | { type: 'conversation.ready'; data: { conversationId: string } }
  | { type: 'chunk'; content: string }
  | { type: 'final'; data: unknown }
  | { type: 'error'; data: { error: { code: string; message: string } } };

export type StreamEventHandler = (event: StreamEvent) => void;

export async function streamChatTurn(
  input: {
    conversationId?: string;
    advisorId?: string;
    content: string;
    clientTurnId?: string;
  },
  onEvent: StreamEventHandler,
  options: { signal?: AbortSignal } = {}
) {
  const response = await fetch('/api/chat-turn/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    signal: options.signal,
    body: JSON.stringify(input)
  });

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'chat_stream_error',
      payload?.error?.message ?? `Stream failed with ${response.status}`,
      payload?.error?.details ?? payload
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const rawEvent of events) {
      const lines = rawEvent.split('\n');
      const type = lines
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        ?.trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => {
          const value = line.slice('data:'.length);
          return value.startsWith(' ') ? value.slice(1) : value;
        })
        .join('\n');

      if (type === 'conversation.ready') {
        onEvent({ type: 'conversation.ready', data: JSON.parse(data) });
      } else if (type === 'chunk') {
        onEvent({ type: 'chunk', content: data });
      } else if (type === 'final') {
        onEvent({ type: 'final', data: JSON.parse(data) });
      } else if (type === 'error') {
        onEvent({ type: 'error', data: JSON.parse(data) });
      }
    }
  }
}
