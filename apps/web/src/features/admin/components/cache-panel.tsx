'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronsUpDown,
  RefreshCwIcon,
  HistoryIcon,
  ArrowLeftRightIcon
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast
} from '@eskwelabs-advisor/ui';

import {
  refreshPromptCache,
  getPromptHealth,
  listAdvisorSnapshots,
  activateAdvisorSnapshot,
  listDnaDigests,
  activateDnaDigest,
  type PromptRefreshResult
} from '@/lib/domains/admin/api';
import { promptCacheQuery } from '@/lib/domains/admin/queries';

interface CacheEntry {
  key: string;
  valueHash: string;
  docRevision: string | null;
  dnaDigestVersion: string | null;
  lastGoodAt: string | null;
  expiresAt: string;
  updatedAt: string;
}

interface RefreshResult {
  data?: PromptRefreshResult;
}

interface AdvisorHealth {
  advisorId: string;
  activeSnapshot: {
    id: string;
    hash: string;
    revision: string;
    validationStatus: string | null;
    validationReason: string | null;
    createdAt: string;
  };
}

interface DnaHealth {
  active: {
    id: string;
    hash: string;
    sourceHash: string;
    revision: string;
    validationStatus: string | null;
    validationReason: string | null;
    createdAt: string;
  };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function shortHash(value: string | null) {
  if (!value) return '—';
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function SortHead({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
        {children}
        <ChevronsUpDown className="text-muted-foreground/40 size-3 shrink-0" />
      </span>
    </TableHead>
  );
}

function refreshFailureMessage(result: PromptRefreshResult | undefined) {
  const dnaDigest = result?.warmed?.dnaDigest;
  if (dnaDigest?.status === 'failed') {
    return dnaDigest.reason
      ? `DNA digest refresh failed: ${dnaDigest.reason}`
      : `DNA digest refresh failed: ${dnaDigest.code ?? 'unknown error'}`;
  }

  const failedPrompt = result?.warmed?.advisorPrompts.find(
    (prompt) => prompt.status === 'failed'
  );
  if (failedPrompt) {
    const detail = failedPrompt.reason ?? failedPrompt.code ?? 'unknown error';
    return `${failedPrompt.advisorId} prompt refresh failed: ${detail}`;
  }

  return 'Prompt cache refresh completed with failures';
}

function RefreshDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: refreshPromptCache,
    onSuccess: (result: RefreshResult) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });

      const status = result.data?.status;
      if (status === 'partial') {
        toast.warning(refreshFailureMessage(result.data));
      } else if (status === 'skipped') {
        toast.warning('Prompt ingestion is not configured');
      } else {
        toast.success('Prompt cache refreshed');
      }
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to refresh prompt cache');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground absolute right-4 top-3 size-8"
          aria-label="Refresh cache"
        >
          <RefreshCwIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Refresh Prompt Cache</DialogTitle>
          <DialogDescription>
            Fetch the latest prompt and DNA metadata from configured sources.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={() => mutate()}
            disabled={isPending}
          >
            {isPending ? 'Refreshing...' : 'Confirm Refresh'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CacheEntryTable() {
  const { data, isLoading, error } = useQuery(promptCacheQuery());
  const entries = (data as { data: CacheEntry[] } | undefined)?.data ?? [];

  if (error) {
    return (
      <p className="text-destructive text-sm">Failed to load cache data.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 px-8 py-8">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">No cache entries found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead className="pl-6">Key</SortHead>
            <SortHead>Value Hash</SortHead>
            <SortHead>Doc Revision</SortHead>
            <SortHead>DNA Digest</SortHead>
            <SortHead>Last Good</SortHead>
            <SortHead>Expires</SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.key}>
              <TableCell className="py-4 pl-6 font-mono text-xs">
                {entry.key}
              </TableCell>
              <TableCell className="py-4 font-mono text-xs">
                {shortHash(entry.valueHash)}
              </TableCell>
              <TableCell className="py-4">
                {entry.docRevision ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {shortHash(entry.docRevision)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-4">
                {entry.dnaDigestVersion ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {shortHash(entry.dnaDigestVersion)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground py-4 text-xs">
                {formatDate(entry.lastGoodAt)}
              </TableCell>
              <TableCell className="text-muted-foreground py-4 pr-6 text-xs">
                {formatDate(entry.expiresAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PromptHealthPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'prompt-health'],
    queryFn: getPromptHealth
  });
  const health = data as
    | { data?: { advisors: AdvisorHealth[]; dna: DnaHealth | null } }
    | undefined;

  if (error) {
    return (
      <p className="text-destructive text-sm">Failed to load health data.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 px-8 py-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!health?.data) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">
          Prompt health data unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {health.data.advisors.map((advisor) => (
        <div key={advisor.advisorId}>
          <h4 className="text-muted-foreground mb-2 font-mono text-xs font-semibold uppercase tracking-wider">
            {advisor.advisorId}
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground text-xs">Hash</span>
              <p className="font-mono text-xs">
                {shortHash(advisor.activeSnapshot.hash)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Revision</span>
              <p className="font-mono text-xs">
                {shortHash(advisor.activeSnapshot.revision)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Validation</span>
              <p className="text-xs">
                {advisor.activeSnapshot.validationStatus ? (
                  <Badge
                    variant={
                      advisor.activeSnapshot.validationStatus === 'ok'
                        ? 'outline'
                        : 'destructive'
                    }
                    className="text-xs"
                  >
                    {advisor.activeSnapshot.validationStatus}
                  </Badge>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Active Since
              </span>
              <p className="text-xs">
                {formatDate(advisor.activeSnapshot.createdAt)}
              </p>
            </div>
          </div>
          <SnapshotRollbackSection
            advisorId={advisor.advisorId}
            queryClient={queryClient}
          />
        </div>
      ))}
      {health.data.dna && (
        <div>
          <h4 className="text-muted-foreground mb-2 font-mono text-xs font-semibold uppercase tracking-wider">
            DNA Digest
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground text-xs">Hash</span>
              <p className="font-mono text-xs">
                {shortHash(health.data.dna.active.hash)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Source Hash</span>
              <p className="font-mono text-xs">
                {shortHash(health.data.dna.active.sourceHash)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Validation</span>
              <p className="text-xs">
                {health.data.dna.active.validationStatus ? (
                  <Badge
                    variant={
                      health.data.dna.active.validationStatus === 'ok'
                        ? 'outline'
                        : 'destructive'
                    }
                    className="text-xs"
                  >
                    {health.data.dna.active.validationStatus}
                  </Badge>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Active Since
              </span>
              <p className="text-xs">
                {formatDate(health.data.dna.active.createdAt)}
              </p>
            </div>
          </div>
          <DnaRollbackSection queryClient={queryClient} />
        </div>
      )}
    </div>
  );
}

function SnapshotRollbackSection({
  advisorId,
  queryClient
}: {
  advisorId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data } = useQuery({
    queryKey: ['admin', 'prompt-snapshots', advisorId],
    queryFn: () => listAdvisorSnapshots(advisorId)
  });
  const snapshots =
    (
      data as
        | {
            data?: Array<{
              id: string;
              hash: string;
              revision: string;
              isActive: boolean;
              validationStatus: string | null;
              createdAt: string;
            }>;
          }
        | undefined
    )?.data ?? [];

  const { mutate } = useMutation({
    mutationFn: ({ snapshotId }: { snapshotId: string }) =>
      activateAdvisorSnapshot(advisorId, snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'prompt-snapshots', advisorId]
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      toast.success('Snapshot activated');
    },
    onError: () => {
      toast.error('Failed to activate snapshot');
    }
  });

  if (snapshots.length <= 1) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <HistoryIcon className="text-muted-foreground size-3" />
        <span className="text-muted-foreground text-xs">Snapshots</span>
      </div>
      <div className="space-y-1">
        {snapshots.slice(0, 5).map((s) => (
          <div
            key={s.id}
            className="border-border flex items-center justify-between rounded border px-3 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              {s.isActive && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  active
                </Badge>
              )}
              <span className="text-muted-foreground truncate font-mono text-[10px]">
                {shortHash(s.hash)}
              </span>
              <span className="text-muted-foreground/50 text-[10px]">
                {formatDate(s.createdAt)}
              </span>
            </div>
            {!s.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Activate snapshot"
                onClick={() => mutate({ snapshotId: s.id })}
              >
                <ArrowLeftRightIcon className="size-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DnaRollbackSection({
  queryClient
}: {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data } = useQuery({
    queryKey: ['admin', 'dna-digests'],
    queryFn: listDnaDigests
  });
  const digests =
    (
      data as
        | {
            data?: Array<{
              id: string;
              hash: string;
              sourceHash: string;
              revision: string;
              isActive: boolean;
              validationStatus: string | null;
              createdAt: string;
            }>;
          }
        | undefined
    )?.data ?? [];

  const { mutate } = useMutation({
    mutationFn: ({ digestId }: { digestId: string }) =>
      activateDnaDigest(digestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dna-digests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      toast.success('DNA digest activated');
    },
    onError: () => {
      toast.error('Failed to activate DNA digest');
    }
  });

  if (digests.length <= 1) return null;

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <HistoryIcon className="text-muted-foreground size-3" />
        <span className="text-muted-foreground text-xs">DNA Digests</span>
      </div>
      <div className="space-y-1">
        {digests.slice(0, 5).map((d) => (
          <div
            key={d.id}
            className="border-border flex items-center justify-between rounded border px-3 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              {d.isActive && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  active
                </Badge>
              )}
              <span className="text-muted-foreground truncate font-mono text-[10px]">
                {shortHash(d.hash)}
              </span>
              <span className="text-muted-foreground/50 text-[10px]">
                {formatDate(d.createdAt)}
              </span>
            </div>
            {!d.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Activate digest"
                onClick={() => mutate({ digestId: d.id })}
              >
                <ArrowLeftRightIcon className="size-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CachePanel() {
  return (
    <Card className="relative flex flex-1 flex-col">
      <RefreshDialog />
      <CardContent className="flex flex-1 flex-col p-0">
        <Tabs defaultValue="health" className="flex flex-1 flex-col">
          <TabsList className="mx-4 mt-4 w-fit sm:mx-6">
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
          </TabsList>
          <TabsContent value="health" className="flex-1">
            <PromptHealthPanel />
          </TabsContent>
          <TabsContent value="cache" className="flex-1">
            <CacheEntryTable />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
