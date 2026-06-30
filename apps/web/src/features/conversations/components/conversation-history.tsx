'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  GrainOverlay,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton
} from '@eskwelabs-advisor/ui';

import { advisorsQuery } from '@/lib/domains/advisors/queries';
import { conversationsQuery } from '@/lib/domains/conversations/queries';

type ConversationRow = {
  id: string;
  advisorId: string;
  title: string;
  updatedAt: string;
};

type ConversationsResponse = {
  data?: ConversationRow[];
  meta?: { nextCursor: string | null };
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function ConversationHistory() {
  const router = useRouter();
  const [advisorId, setAdvisorId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [pages, setPages] = useState<ConversationRow[]>([]);
  const scopedAdvisorId = advisorId === 'all' ? undefined : advisorId;
  const { data: advisorsData, isLoading: advisorsLoading } =
    useQuery(advisorsQuery);
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    isFetching: conversationsFetching,
    isError
  } = useQuery(
    conversationsQuery({
      advisorId: scopedAdvisorId,
      search: search.trim() || undefined,
      limit: 20,
      cursor
    })
  );

  const advisorNameById = useMemo(
    () =>
      new Map(
        (advisorsData?.data ?? []).map((advisor) => [advisor.id, advisor.name])
      ),
    [advisorsData]
  );
  useEffect(() => {
    setCursor(undefined);
    setPages([]);
  }, [scopedAdvisorId, search]);

  useEffect(() => {
    const rows = (conversationsData as ConversationsResponse | undefined)?.data;
    if (!rows) return;
    setPages((current) => (cursor ? [...current, ...rows] : rows));
  }, [conversationsData, cursor]);

  const conversations = pages;
  const nextCursor = (conversationsData as ConversationsResponse | undefined)
    ?.meta?.nextCursor;
  const isLoading =
    advisorsLoading || (conversationsLoading && pages.length === 0);

  return (
    <GrainOverlay intensity="subtle" className="bg-background min-h-dvh">
      <Container className="py-8 md:py-10">
        <div className="space-y-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-foreground font-serif text-3xl font-bold">
                Conversation history
              </h1>
              <p className="text-muted-foreground text-sm">
                Resume prior chats for the selected advisor.
              </p>
            </div>
            <div className="xs:flex-row flex flex-col gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations"
                className="xs:w-64 w-full"
              />
              <Select value={advisorId} onValueChange={setAdvisorId}>
                <SelectTrigger className="xs:w-64 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All advisors</SelectItem>
                  {(advisorsData?.data ?? []).map(
                    (advisor: { id: string; name: string }) => (
                      <SelectItem key={advisor.id} value={advisor.id}>
                        {advisor.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={() =>
                  router.push(
                    scopedAdvisorId
                      ? `/chat?advisor=${scopedAdvisorId}`
                      : '/advisors'
                  )
                }
              >
                <Plus className="size-4" />
                New chat
              </Button>
            </div>
          </header>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isError ? (
                <p className="text-destructive text-sm">
                  Could not load conversations.
                </p>
              ) : isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))
              ) : conversations.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                  <MessageSquareText className="text-muted-foreground size-8" />
                  <p className="text-muted-foreground text-sm">
                    No conversations found for this view.
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className="border-border hover:bg-accent/60 focus-visible:ring-ring flex w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
                    onClick={() =>
                      router.push(`/chat?conversation=${conversation.id}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-foreground line-clamp-2 text-sm font-medium">
                        {conversation.title}
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {advisorNameById.get(conversation.advisorId) ??
                          conversation.advisorId}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {formatUpdatedAt(conversation.updatedAt)}
                    </span>
                  </button>
                ))
              )}
              {nextCursor && !isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={conversationsFetching}
                  onClick={() => setCursor(nextCursor)}
                >
                  {conversationsFetching ? 'Loading...' : 'Load more'}
                </Button>
              )}
            </CardContent>
          </Card>
          <p className="text-muted-foreground text-center text-xs">
            Conversations are logged and monitored for quality, safety, and
            usage reporting.
          </p>
        </div>
      </Container>
    </GrainOverlay>
  );
}
