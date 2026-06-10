'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, RefreshCwIcon } from 'lucide-react';

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
  toast
} from '@eskwelabs-advisor/ui';

import { refreshPromptCache } from '@/lib/domains/admin/api';
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
  data?: {
    status: 'skipped' | 'partial' | 'refreshed';
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

function RefreshDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: refreshPromptCache,
    onSuccess: (result: RefreshResult) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });

      const status = result.data?.status;
      if (status === 'partial') {
        toast.warning('Prompt cache refresh completed with failures');
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

export function CachePanel() {
  const { data, isLoading, error } = useQuery(promptCacheQuery);
  const entries = (data as { data: CacheEntry[] } | undefined)?.data ?? [];

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">Failed to load cache data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative flex flex-1 flex-col">
      <RefreshDialog />
      <CardContent className="flex flex-1 flex-col p-0">
        {isLoading ? (
          <div className="space-y-3 px-8 py-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No cache entries found.
            </p>
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
