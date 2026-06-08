'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCwIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Separator,
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
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function shortHash(value: string | null) {
  if (!value) return '-';
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
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
        <Button variant="outline" size="sm">
          <RefreshCwIcon className="size-4" />
          Refresh
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
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Prompt Cache</CardTitle>
          <CardDescription>TTL is 5 minutes.</CardDescription>
        </div>
        <RefreshDialog />
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 px-6 py-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-sm">
            No cache entries found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value Hash</TableHead>
                  <TableHead>Doc Revision</TableHead>
                  <TableHead>DNA Digest</TableHead>
                  <TableHead>Last Good</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.key}>
                    <TableCell className="font-mono text-xs">
                      {entry.key}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortHash(entry.valueHash)}
                    </TableCell>
                    <TableCell>
                      {entry.docRevision ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {shortHash(entry.docRevision)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.dnaDigestVersion ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {shortHash(entry.dnaDigestVersion)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(entry.lastGoodAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
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
