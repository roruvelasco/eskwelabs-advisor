'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  GrainOverlay,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './chat-sidebar';
import { ChatComposer } from './chat-composer';
import { ChatMessages, type Message } from './chat-messages';
import { messagesQuery } from '@/lib/domains/chat/queries';
import { createChatTurn } from '@/lib/domains/chat/api';
import { createConversation } from '@/lib/domains/conversations/api';

function ChatLayoutInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const { open, isMobile, openMobile } = useSidebar();

  const {
    data: messagesResponse,
    isLoading,
    isError
  } = useQuery({
    ...messagesQuery(conversationId ?? ''),
    enabled: Boolean(conversationId)
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      let cid = conversationId;
      if (!cid) {
        const result = await createConversation({
          advisorId: 'data-dashboard'
        });
        cid = (result as { data: { id: string } }).data.id;
        router.replace(`/chat?conversation=${cid}`);
      }
      await createChatTurn({ conversationId: cid, content });
      return cid;
    },
    onSuccess: (cid) => {
      queryClient.invalidateQueries({ queryKey: ['messages', cid] });
    }
  });

  const loadedMessages: Message[] = (
    (messagesResponse?.data ?? []) as Array<{
      id: string;
      role: string;
      content: string;
    }>
  ).map((msg) => ({
    id: msg.id,
    role: msg.role === 'assistant' ? 'advisor' : 'user',
    content: msg.content
  }));

  const messages = conversationId ? loadedMessages : [];
  const triggerHidden = isMobile ? openMobile : open;
  const hasMessages = messages.length > 0 || sendMutation.isPending;

  const handleSend = useCallback(
    (text: string) => {
      sendMutation.mutate(text);
    },
    [sendMutation]
  );

  return (
    <>
      <ChatSidebar />

      <SidebarInset className="bg-background h-dvh overflow-hidden p-3">
        <GrainOverlay
          intensity="subtle"
          className="bg-card border-border flex h-full min-h-0 flex-col overflow-hidden rounded-xl border"
        >
          <header
            className={cn(
              'flex h-14 shrink-0 items-center px-4 transition-opacity duration-300 ease-in-out',
              triggerHidden
                ? 'pointer-events-none invisible opacity-0'
                : 'opacity-100'
            )}
          >
            <SidebarTrigger
              aria-controls="chat-sidebar"
              aria-label="Open sidebar"
              className="size-9"
            />
          </header>

          {isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Loading messages...
              </p>
            </div>
          ) : isError ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Could not load messages.
              </p>
            </div>
          ) : hasMessages ? (
            <>
              <ChatMessages messages={messages} />
              <div className="border-border/50 shrink-0 border-t p-3">
                <ChatComposer onSend={handleSend} />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto">
              <Container className="motion-stagger-in flex flex-col items-center gap-6 px-4 py-12">
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-foreground text-balance font-serif text-4xl leading-[1.1] tracking-tight md:text-5xl">
                    Let&apos;s get to work, cohort fellow.
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Ask anything — your advisor is ready.
                  </p>
                </div>

                <ChatComposer onSend={handleSend} />
              </Container>
            </div>
          )}
        </GrainOverlay>
      </SidebarInset>
    </>
  );
}

function ChatLayout() {
  return (
    <Suspense>
      <ChatLayoutInner />
    </Suspense>
  );
}

export function NewChatShell() {
  return (
    <SidebarProvider defaultOpen className="h-dvh min-h-0 overflow-hidden">
      <ChatLayout />
    </SidebarProvider>
  );
}
