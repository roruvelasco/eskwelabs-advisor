'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
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

const NEAR_BOTTOM_PX = 150;

export function ChatMessages({
  messages,
  onRetry
}: {
  messages: Message[];
  onRetry?: (userContent: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  useEffect(() => {
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6"
    >
      {messages.map((msg, idx) => (
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
                <>
                  <MessageResponse isAnimating={msg.status === 'streaming'}>
                    {msg.content}
                  </MessageResponse>
                  {msg.status === 'error' && onRetry && (
                    <button
                      type="button"
                      onClick={() => {
                        const prev = messages[idx - 1];
                        if (prev?.role === 'user') onRetry(prev.content);
                      }}
                      className="text-destructive hover:text-destructive/80 mt-1 flex items-center gap-1.5 text-xs transition-colors"
                    >
                      <RotateCcw className="size-3" />
                      Retry
                    </button>
                  )}
                </>
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
