'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
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
import { AdvisorChip } from './advisor-chip';
import { cn } from '@/lib/utils';
import { ChatSidebar } from './chat-sidebar';
import { ChatComposer } from './chat-composer';
import { ChatMessages, type Message } from './chat-messages';
import { messagesQuery } from '@/lib/domains/chat/queries';
import { streamChatTurn } from '@/lib/domains/chat/api';
import { createConversation } from '@/lib/domains/conversations/api';
import { conversationQuery } from '@/lib/domains/conversations/queries';
import { advisorsQuery } from '@/lib/domains/advisors/queries';

type StreamFinalData = {
  userMessage: {
    id: string;
    role: string;
    content: string;
  };
  assistantMessage: {
    id: string;
    role: string;
    content: string;
  };
};

function ChatLayoutInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const advisorId = searchParams.get('advisor');
  const { open, isMobile, openMobile } = useSidebar();
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [liveConversationId, setLiveConversationId] = useState<string>();

  useEffect(() => {
    if (!conversationId && !advisorId) router.replace('/advisors');
  }, [advisorId, conversationId, router]);

  const {
    data: messagesResponse,
    isLoading,
    isError
  } = useQuery({
    ...messagesQuery(conversationId ?? ''),
    enabled: Boolean(conversationId)
  });
  const { data: conversationResponse } = useQuery({
    ...conversationQuery(conversationId ?? ''),
    enabled: Boolean(conversationId)
  });
  const { data: advisorsResponse } = useQuery(advisorsQuery);

  const currentAdvisorId =
    advisorId ??
    (conversationResponse as { data?: { advisorId?: string } } | undefined)
      ?.data?.advisorId;
  const currentAdvisor = (advisorsResponse?.data ?? []).find(
    (advisor) => advisor.id === currentAdvisorId
  );
  const currentAdvisorName = currentAdvisor?.name ?? 'Advisor';

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      let cid = conversationId;
      if (!cid) {
        if (!advisorId) throw new Error('Advisor is required');
        const result = await createConversation({
          advisorId,
          title: content.slice(0, 80)
        });
        cid = (result as { data: { id: string } }).data.id;
        router.replace(`/chat?conversation=${cid}`);
      }

      setLiveConversationId(cid);
      const userTempId = `user:${crypto.randomUUID()}`;
      const assistantTempId = `assistant:${crypto.randomUUID()}`;
      setLiveMessages((current) => [
        ...current,
        { id: userTempId, role: 'user', content, status: 'complete' },
        {
          id: assistantTempId,
          role: 'advisor',
          content: '',
          status: 'thinking'
        }
      ]);

      let finalData: StreamFinalData | undefined;
      await streamChatTurn({ conversationId: cid, content }, (event) => {
        if (event.type === 'chunk') {
          setLiveMessages((current) =>
            current.map((message) =>
              message.id === assistantTempId
                ? {
                    ...message,
                    content: message.content + event.content,
                    status: 'streaming'
                  }
                : message
            )
          );
          return;
        }

        if (event.type === 'final') {
          finalData = event.data as StreamFinalData;
          setLiveMessages((current) =>
            current.map((message) => {
              if (message.id === userTempId) {
                return {
                  id: finalData!.userMessage.id,
                  role: 'user',
                  content: finalData!.userMessage.content,
                  status: 'complete'
                };
              }

              if (message.id === assistantTempId) {
                return {
                  id: finalData!.assistantMessage.id,
                  role: 'advisor',
                  content: finalData!.assistantMessage.content,
                  status: 'complete'
                };
              }

              return message;
            })
          );
          return;
        }

        throw new Error('Chat stream failed');
      });

      if (!finalData) throw new Error('Chat stream ended without final data');
      return cid;
    },
    onSuccess: async (cid) => {
      await queryClient.invalidateQueries({ queryKey: ['messages', cid] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setLiveMessages([]);
      setLiveConversationId(undefined);
    },
    onError: () => {
      setLiveMessages((current) =>
        current.map((message) =>
          message.role === 'advisor' &&
          (message.status === 'thinking' || message.status === 'streaming')
            ? {
                ...message,
                content: message.content || 'Request failed.',
                status: 'error'
              }
            : message
        )
      );
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

  const liveBelongsToCurrent =
    liveConversationId &&
    (!conversationId || liveConversationId === conversationId);
  const liveIds = new Set(liveMessages.map((m) => m.id));
  const messages = [
    ...(conversationId ? loadedMessages.filter((m) => !liveIds.has(m.id)) : []),
    ...(liveBelongsToCurrent ? liveMessages : [])
  ];
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
      <ChatSidebar
        currentAdvisorId={currentAdvisorId}
        currentConversationId={conversationId ?? undefined}
      />

      <SidebarInset className="bg-background h-dvh overflow-hidden p-3">
        <GrainOverlay
          intensity="subtle"
          className="bg-card border-border flex h-full min-h-0 flex-col overflow-hidden rounded-xl border"
        >
          <header className="flex h-14 shrink-0 items-center justify-between px-4">
            <div
              className={cn(
                'transition-opacity duration-300 ease-in-out',
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
            </div>
            {currentAdvisorId && (
              <AdvisorChip id={currentAdvisorId} name={currentAdvisorName} />
            )}
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
                <ChatComposer
                  disabled={sendMutation.isPending}
                  onSend={handleSend}
                />
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

                <ChatComposer
                  disabled={sendMutation.isPending}
                  onSend={handleSend}
                />
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
