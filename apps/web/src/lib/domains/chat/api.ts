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
  status: 'ok' | 'blocked' | 'error';
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
}) {
  return apiClient['chat-turn']
    .$post({
      json: input
    })
    .then((response) => response.json());
}

export async function streamChatTurn(
  input: { conversationId: string; content: string },
  onEvent: (event: { type: 'chunk'; content: string } | { type: 'final' | 'error'; data: unknown }) => void
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
        .map((line) => line.slice('data:'.length).trim())
        .join('\n');

      if (type === 'chunk') {
        onEvent({ type, content: data });
      } else if (type === 'final' || type === 'error') {
        onEvent({ type, data: JSON.parse(data) as unknown });
      }
    }
  }
}
