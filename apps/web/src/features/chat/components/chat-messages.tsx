'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Message as AiMessage,
  MessageContent,
  MessageResponse,
  DotWave
} from '@eskwelabs-advisor/ui';

export type Message = {
  id: string;
  role: 'user' | 'advisor';
  content: string;
  status?: 'streaming' | 'thinking' | 'complete' | 'error' | 'cancelled';
};

export function ChatMessages({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((msg) => (
        <AiMessage
          key={msg.id}
          className={cn(msg.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          <MessageContent
            className={cn(
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm',
              msg.status === 'error' && 'border-destructive/30 border',
              msg.status === 'cancelled' && 'border-border border'
            )}
          >
            {msg.role === 'advisor' ? (
              msg.status === 'thinking' && !msg.content ? (
                <div
                  aria-label="Advisor is thinking"
                  className="flex items-center gap-2"
                >
                  <DotWave size={24} speed={1} color="currentColor" />
                </div>
              ) : (
                <MessageResponse isAnimating={msg.status === 'streaming'}>
                  {msg.content}
                </MessageResponse>
              )
            ) : (
              msg.content
            )}
          </MessageContent>
        </AiMessage>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
