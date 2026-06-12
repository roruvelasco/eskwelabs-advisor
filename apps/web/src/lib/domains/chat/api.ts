import { apiClient } from '@/lib/api/client';

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

export function listMessages(conversationId: string) {
  return apiClient.messages
    .$get({
      query: { conversationId }
    })
    .then((response) => response.json());
}

export function createChatTurn(input: {
  conversationId: string;
  content: string;
  clientTurnId?: string;
}) {
  return apiClient['chat-turn']
    .$post({
      json: input
    })
    .then((response) => response.json());
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
  onEvent: StreamEventHandler
) {
  const response = await fetch('/api/chat-turn/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(input)
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream failed with ${response.status}`);
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
        .trim();
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
