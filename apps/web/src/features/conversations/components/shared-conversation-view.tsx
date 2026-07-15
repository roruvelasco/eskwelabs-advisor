'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge, GrainOverlay } from '@eskwelabs-advisor/ui';
import {
  ChatMessages,
  type Message
} from '@/features/chat/components/chat-messages';
import { sharedConversationQuery } from '@/lib/domains/conversations/queries';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function SharedConversationView({ shareId }: { shareId: string }) {
  const { data, isLoading, isError } = useQuery(
    sharedConversationQuery(shareId)
  );

  const view = data?.data;
  const messages: Message[] = (view?.messages ?? []).map((msg, idx) => ({
    id: `shared-${idx}`,
    role: msg.role === 'assistant' ? 'advisor' : 'user',
    content: msg.content,
    status: 'complete'
  }));

  return (
    <div className="bg-background h-dvh overflow-hidden p-3">
      <GrainOverlay
        intensity="subtle"
        className="bg-card border-border mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl border"
      >
        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Loading conversation...
            </p>
          </div>
        ) : isError || !view ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <h1 className="text-foreground font-serif text-2xl">
              Conversation unavailable
            </h1>
            <p className="text-muted-foreground text-sm">
              This shared conversation does not exist or is no longer available.
            </p>
          </div>
        ) : (
          <>
            <header className="border-border/50 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <h1 className="text-foreground truncate text-sm font-medium">
                  {view.conversation.title}
                </h1>
                <p className="text-muted-foreground text-xs">
                  {view.conversation.advisorName} ·{' '}
                  {formatDate(view.conversation.createdAt)}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                Read-only
              </Badge>
            </header>

            <ChatMessages messages={messages} />

            <footer className="border-border/50 shrink-0 border-t p-3">
              <p className="text-muted-foreground text-center text-xs">
                This is a shared, read-only view of a conversation with the
                Eskwelabs Advisor.
              </p>
            </footer>
          </>
        )}
      </GrainOverlay>
    </div>
  );
}
