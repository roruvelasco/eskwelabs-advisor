'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { ConsentDialog } from '@/features/auth/components/consent-dialog';
import { acknowledgeConsent, getConsent } from '@/lib/domains/auth/api';
import { messagesQuery, messagesQueryKey } from '@/lib/domains/chat/queries';
import { streamChatTurn } from '@/lib/domains/chat/api';
import { conversationQuery } from '@/lib/domains/conversations/queries';
import { advisorsQuery } from '@/lib/domains/advisors/queries';

const CONSENT_KEY = 'eskwelabs-advisor:monitoring-notice-seen';

type StreamFinalData = {
  userMessage: { id: string; role: string; content: string };
  assistantMessage: { id: string; role: string; content: string };
};

type CacheMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: string;
};

type CacheData = { data: CacheMessage[] };

function messagesDraftKey(clientTurnId: string) {
  return ['messages', 'draft', clientTurnId] as const;
}

function toDisplayStatus(status?: string): Message['status'] {
  if (!status || status === 'ok') return 'complete';
  if (status === 'blocked') return 'error';
  return status as Message['status'];
}

function ChatLayoutInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversation');
  const advisorId = searchParams.get('advisor');
  const { open, isMobile, openMobile } = useSidebar();
  const [stableSidebarAdvisorId, setStableSidebarAdvisorId] =
    useState<string>();
  const streamRef = useRef<{
    clientTurnId: string;
    assistantTempId: string;
    createdConversationId?: string;
  } | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // ── Consent ───────────────────────────────────────────────────────────────
  const [consentOpen, setConsentOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consentError, setConsentError] = useState<string>();

  const { isLoading: isConsentLoading } = useQuery({
    queryKey: ['consent'],
    queryFn: getConsent
  });

  useEffect(() => {
    if (isConsentLoading) return;
    const seen = window.sessionStorage.getItem(CONSENT_KEY) === 'true';
    setConsentOpen(!seen);
  }, [isConsentLoading]);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setConsentError(undefined);
    try {
      await acknowledgeConsent();
    } catch {
      setConsentError('Could not record acknowledgement. Please try again.');
      setIsAcknowledging(false);
      return;
    }
    try {
      window.sessionStorage.setItem(CONSENT_KEY, 'true');
    } catch {
      // ignore
    }
    setAcknowledged(true);
    setTimeout(() => setConsentOpen(false), 1100);
    setIsAcknowledging(false);
  };

  useEffect(() => {
    if (!conversationId && !advisorId) router.replace('/advisors');
  }, [advisorId, conversationId, router]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const clientTurnId = crypto.randomUUID();
      const userTempId = `user:${crypto.randomUUID()}`;
      const assistantTempId = `assistant:${crypto.randomUUID()}`;

      streamRef.current = { clientTurnId, assistantTempId };
      if (!conversationId) setActiveDraftId(clientTurnId);

      const optimisticTurn: CacheMessage[] = [
        { id: userTempId, role: 'user', content, status: 'complete' },
        {
          id: assistantTempId,
          role: 'assistant',
          content: '',
          status: 'thinking'
        }
      ];

      if (conversationId) {
        queryClient.setQueryData<CacheData>(
          messagesQueryKey(conversationId),
          (prev) => ({
            data: [...(prev?.data ?? []), ...optimisticTurn]
          })
        );
      } else {
        queryClient.setQueryData<CacheData>(messagesDraftKey(clientTurnId), {
          data: optimisticTurn
        });
      }

      let finalData: StreamFinalData | undefined;
      let createdConversationId: string | undefined;

      await streamChatTurn(
        {
          ...(conversationId ? { conversationId } : { advisorId: advisorId! }),
          content,
          clientTurnId
        },
        (event) => {
          if (event.type === 'conversation.ready') {
            createdConversationId = event.data.conversationId;
            streamRef.current!.createdConversationId = createdConversationId;

            const draftData = queryClient.getQueryData<CacheData>(
              messagesDraftKey(clientTurnId)
            );
            if (draftData) {
              queryClient.setQueryData<CacheData>(
                messagesQueryKey(createdConversationId),
                draftData
              );
            }

            window.history.replaceState(
              null,
              '',
              `/chat?conversation=${createdConversationId}`
            );
            return;
          }

          if (event.type === 'chunk') {
            const key = createdConversationId ?? conversationId;
            const cacheKey = key
              ? messagesQueryKey(key)
              : messagesDraftKey(clientTurnId);
            queryClient.setQueryData<CacheData>(cacheKey, (prev) => {
              if (!prev) return prev;
              return {
                data: prev.data.map((msg) =>
                  msg.id === assistantTempId
                    ? {
                        ...msg,
                        content: msg.content + event.content,
                        status: 'streaming'
                      }
                    : msg
                )
              };
            });
            return;
          }

          if (event.type === 'final') {
            finalData = event.data as StreamFinalData;
            const key = createdConversationId ?? conversationId;
            const cacheKey = key
              ? messagesQueryKey(key)
              : messagesDraftKey(clientTurnId);
            queryClient.setQueryData<CacheData>(cacheKey, (prev) => {
              if (!prev) return prev;
              return {
                data: prev.data.map((msg) => {
                  if (msg.id === userTempId) {
                    return {
                      ...msg,
                      id: finalData!.userMessage.id,
                      status: 'complete'
                    };
                  }
                  if (msg.id === assistantTempId) {
                    return {
                      ...msg,
                      id: finalData!.assistantMessage.id,
                      content: finalData!.assistantMessage.content,
                      status: 'complete'
                    };
                  }
                  return msg;
                })
              };
            });
            return;
          }

          if (event.type === 'error') {
            throw new Error(
              (event.data as { error?: { message?: string } })?.error
                ?.message ?? 'Chat stream failed'
            );
          }
        }
      );

      if (!finalData) throw new Error('Chat stream ended without final data');
      return createdConversationId ?? conversationId ?? '';
    },
    onSuccess: async (cid) => {
      setActiveDraftId(null);
      await queryClient.invalidateQueries({ queryKey: ['messages', cid] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      streamRef.current = null;
    },
    onError: () => {
      setActiveDraftId(null);
      const info = streamRef.current;
      if (!info) return;

      const liveKey = info.createdConversationId ?? conversationId;
      const cacheKey = liveKey
        ? messagesQueryKey(liveKey)
        : messagesDraftKey(info.clientTurnId);

      queryClient.setQueryData<CacheData>(cacheKey, (prev) => {
        if (!prev) return prev;
        return {
          data: prev.data.map((msg) =>
            msg.id === info.assistantTempId
              ? {
                  ...msg,
                  content: msg.content || 'Request failed.',
                  status: 'error'
                }
              : msg
          )
        };
      });

      streamRef.current = null;
    }
  });

  const {
    data: messagesResponse,
    isLoading,
    isError
  } = useQuery({
    ...messagesQuery({ conversationId: conversationId ?? '' }),
    enabled: Boolean(conversationId) && !sendMutation.isPending
  });
  const { data: draftMessagesResponse } = useQuery<CacheData>({
    queryKey: messagesDraftKey(activeDraftId ?? ''),
    queryFn: () =>
      queryClient.getQueryData<CacheData>(
        messagesDraftKey(activeDraftId ?? '')
      ) ?? { data: [] },
    enabled: Boolean(activeDraftId) && !conversationId
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
  const sidebarAdvisorId = currentAdvisorId ?? stableSidebarAdvisorId;
  useEffect(() => {
    if (currentAdvisorId) {
      setStableSidebarAdvisorId(currentAdvisorId);
    }
  }, [currentAdvisorId]);
  const isResolvingConversationAdvisor =
    Boolean(conversationId) && !sidebarAdvisorId;
  const currentAdvisor = (advisorsResponse?.data ?? []).find(
    (advisor) => advisor.id === currentAdvisorId
  );
  const currentAdvisorName = currentAdvisor?.name ?? 'Advisor';

  const rawMessages = (draftMessagesResponse?.data ??
    messagesResponse?.data ??
    []) as CacheMessage[];
  const loadedMessages: Message[] = rawMessages.map((msg) => ({
    id: msg.id,
    role: msg.role === 'assistant' ? 'advisor' : 'user',
    content: msg.content,
    status: toDisplayStatus(msg.status)
  }));

  const hasCachedData = loadedMessages.length > 0;
  const triggerHidden = isMobile ? openMobile : open;
  const hasMessages = loadedMessages.length > 0 || sendMutation.isPending;

  const handleSend = useCallback(
    (text: string) => {
      sendMutation.mutate(text);
    },
    [sendMutation]
  );

  return (
    <>
      <ConsentDialog
        open={consentOpen}
        acknowledged={acknowledged}
        isAcknowledging={isAcknowledging}
        error={consentError}
        onAcknowledge={handleAcknowledge}
      />

      <ChatSidebar
        currentAdvisorId={sidebarAdvisorId}
        currentConversationId={conversationId ?? undefined}
        isResolvingConversationAdvisor={isResolvingConversationAdvisor}
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

          {isLoading && !hasCachedData && !sendMutation.isPending ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Loading messages...
              </p>
            </div>
          ) : isError && !hasCachedData ? (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                Could not load messages.
              </p>
            </div>
          ) : hasMessages ? (
            <>
              <ChatMessages messages={loadedMessages} />
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
