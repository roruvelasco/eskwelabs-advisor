'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast
} from '@eskwelabs-advisor/ui';

import { cn } from '@/lib/utils';

import { AdminDataTable } from './admin-data-table';
import type { ColumnDef } from '@tanstack/react-table';

import {
  createKnowledgeSource,
  refreshAllKnowledgeSources,
  refreshKnowledgeSource,
  refreshPromptCache,
  updateDnaSource,
  updateKnowledgeSource
} from '@/lib/domains/admin/api';
import {
  adminAdvisorsQuery,
  dnaSourceQuery,
  knowledgeSourcesQuery,
  telemetryQuery,
  knowledgeHealthQuery
} from '@/lib/domains/admin/queries';
import { AdminEmptyState } from './admin-table';

type SourceKind = 'dna' | 'knowledge_reference';

interface DnaSource {
  docId: string | null;
  source: 'database' | 'active_digest' | 'env_fallback';
  updatedBy: string | null;
  updatedAt: string | null;
}

interface KnowledgeSource {
  id: string;
  title: string;
  sourceType: string;
  externalId: string;
  status: string;
  contentType: string;
  advisorScope: string;
  revision: string | null;
  lastIngestedAt: string | null;
  updatedAt: string;
}

interface TelemetryEventRow {
  id: string;
  eventName: string;
  actorId: string | null;
  severity: 'info' | 'warning' | 'error';
  payload: Record<string, unknown>;
  createdAt: string;
}

interface SelectionRow {
  id: string;
  kind: SourceKind;
  label: string;
  scope: string;
  docId: string | null;
  status: string;
  revision: string | null;
  refreshedAt: string | null;
  source?: KnowledgeSource;
}

const CONTENT_TYPES = [
  'policy',
  'faq',
  'course_material',
  'mentor_guide',
  'rubric',
  'ops_rule',
  'advisor_reference'
];

const LOG_EVENTS = new Set([
  'admin_cache_refresh',
  'admin_cache_refresh_failed',
  'cron_cache_refresh',
  'cron_cache_refresh_failed',
  'google_docs_fetch',
  'doc_fetch_error',
  'prompt_snapshot_refreshed',
  'prompt_snapshot_unchanged',
  'prompt_validation_failed',
  'dna_digest_regenerated',
  'dna_digest_skipped_unchanged',
  'dna_validation_failed',
  'dna_digest_validation_failed',
  'dna_source_updated',
  'knowledge_source_created',
  'knowledge_source_updated',
  'knowledge_source_refreshed'
]);

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

function shortValue(value: string | null) {
  if (!value) return '-';
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function kindLabel(kind: SourceKind) {
  if (kind === 'dna') return 'Shared DNA';
  return 'Knowledge Reference';
}

function kindAndScopeLabel(kind: SourceKind, scope: string) {
  const label = kindLabel(kind);
  if (kind === 'dna') return label;
  return `${label} · ${scope}`;
}

function statusVariant(status: string) {
  if (['active', 'published', 'ok', 'refreshed'].includes(status)) {
    return 'default' as const;
  }
  if (['failed', 'error'].includes(status)) return 'destructive' as const;
  return 'secondary' as const;
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function EditSourceDialog({
  row,
  advisorScopes
}: {
  row: SelectionRow;
  advisorScopes: string[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState(row.docId ?? '');
  const [title, setTitle] = useState(row.source?.title ?? row.label);
  const [contentType, setContentType] = useState(
    row.source?.contentType ?? 'advisor_reference'
  );
  const [advisorScope, setAdvisorScope] = useState(
    row.source?.advisorScope ?? 'global'
  );
  const [status, setStatus] = useState(row.source?.status ?? 'published');

  const mutation = useMutation({
    mutationFn: () => {
      const trimmedDocId = docId.trim();
      if (row.kind === 'dna') {
        return updateDnaSource({ docId: trimmedDocId });
      }
      return updateKnowledgeSource(row.id, {
        externalId: trimmedDocId,
        title: title.trim(),
        contentType,
        advisorScope,
        status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dna-source'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      toast.success('Document source updated');
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to update document source');
    }
  });

  const canSave =
    row.kind === 'dna'
      ? docId.trim().length > 0
      : docId.trim().length > 0 && title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit document source">
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Document Source</DialogTitle>
          <DialogDescription>
            Update the Google Doc reference used by this runtime source.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {row.kind === 'knowledge_reference' ? (
            <div className="space-y-2">
              <Label htmlFor={`title-${row.id}`}>Title</Label>
              <Input
                id={`title-${row.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`doc-${row.id}`}>Google Doc ID</Label>
            <Input
              id={`doc-${row.id}`}
              value={docId}
              onChange={(event) => setDocId(event.target.value)}
              placeholder="1a2b3c4d5e..."
            />
          </div>
          {row.kind === 'knowledge_reference' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Content</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={advisorScope} onValueChange={setAdvisorScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {advisorScopes.map((scope) => (
                      <SelectItem key={scope} value={scope}>
                        {scope}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="published">published</SelectItem>
                    <SelectItem value="retired">retired</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddKnowledgeSourceDialog({
  advisorScopes
}: {
  advisorScopes: string[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [externalId, setExternalId] = useState('');
  const [contentType, setContentType] = useState('advisor_reference');
  const [advisorScope, setAdvisorScope] = useState('global');

  const mutation = useMutation({
    mutationFn: () =>
      createKnowledgeSource({
        sourceType: 'google_doc',
        externalId: externalId.trim(),
        title: title.trim(),
        advisorScope,
        contentType,
        audience: 'advisor',
        status: 'published'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-health']
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      toast.success('Knowledge source added');
      setOpen(false);
      setTitle('');
      setExternalId('');
    },
    onError: () => {
      toast.error('Failed to add knowledge source');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-[#2d6a4f]"
        >
          <PlusIcon className="size-3.5" />
          Add Source
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Source</DialogTitle>
          <DialogDescription>
            Register a Google Doc for source-backed factual grounding.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-source-title">Title</Label>
            <Input
              id="new-source-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enrollment Policies"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-source-doc">Google Doc ID</Label>
            <Input
              id="new-source-doc"
              value={externalId}
              onChange={(event) => setExternalId(event.target.value)}
              placeholder="1a2b3c4d5e..."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Content</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={advisorScope} onValueChange={setAdvisorScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {advisorScopes.map((scope) => (
                    <SelectItem key={scope} value={scope}>
                      {scope}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              title.trim().length === 0 ||
              externalId.trim().length === 0 ||
              mutation.isPending
            }
          >
            {mutation.isPending ? 'Adding...' : 'Add Source'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefreshAllButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await refreshPromptCache();
      return refreshAllKnowledgeSources();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-health']
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      toast.success('Document sources refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh document sources');
    }
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium transition-colors',
        mutation.isPending
          ? 'text-muted-foreground/50'
          : 'text-muted-foreground hover:text-[#2d6a4f]'
      )}
    >
      <RefreshCwIcon
        className={`size-3.5 ${mutation.isPending ? 'animate-spin' : ''}`}
      />
      Refresh all
    </button>
  );
}

function SelectionsTable({ advisorScopes }: { advisorScopes: string[] }) {
  const queryClient = useQueryClient();
  const dnaQuery = useQuery(dnaSourceQuery);
  const sourcesQuery = useQuery(knowledgeSourcesQuery());

  const dnaSource = (dnaQuery.data as { data: DnaSource } | undefined)?.data;
  const knowledgeSources =
    (sourcesQuery.data as { data: KnowledgeSource[] } | undefined)?.data ?? [];

  const rows: SelectionRow[] = [
    {
      id: 'dna',
      kind: 'dna',
      label: 'Eskwelabs DNA',
      scope: 'global',
      docId: dnaSource?.docId ?? null,
      status: dnaSource?.source ?? 'not_configured',
      revision: null,
      refreshedAt: dnaSource?.updatedAt ?? null
    },
    ...knowledgeSources.map((source) => ({
      id: source.id,
      kind: 'knowledge_reference' as const,
      label: source.title,
      scope: source.advisorScope,
      docId: source.externalId,
      status: source.status,
      revision: source.revision,
      refreshedAt: source.lastIngestedAt ?? source.updatedAt,
      source
    }))
  ];

  const refreshMutation = useMutation({
    mutationFn: async (row: SelectionRow) => {
      if (row.kind === 'knowledge_reference') {
        return refreshKnowledgeSource(row.id);
      }
      return refreshPromptCache();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dna-source'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'telemetry'] });
      toast.success('Source refresh started');
    },
    onError: () => {
      toast.error('Failed to refresh source');
    }
  });

  const isLoading = dnaQuery.isLoading || sourcesQuery.isLoading;
  const hasError = dnaQuery.error || sourcesQuery.error;

  if (hasError) {
    return (
      <AdminEmptyState
        message="Failed to load document sources."
        actionLabel="Retry"
        onAction={() => {
          dnaQuery.refetch();
          sourcesQuery.refetch();
        }}
      />
    );
  }

  return (
    <AdminDataTable
      columns={
        [
          {
            accessorKey: 'label',
            header: 'Source',
            cell: ({ row }) => (
              <span className="font-medium">{row.original.label}</span>
            )
          },
          {
            id: 'type',
            header: 'Type',
            cell: ({ row }) => (
              <span className="text-muted-foreground text-xs">
                {kindAndScopeLabel(row.original.kind, row.original.scope)}
              </span>
            )
          },
          {
            accessorKey: 'docId',
            header: 'Doc ID',
            cell: ({ row }) => (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help font-mono text-xs">
                      {shortValue(row.original.docId)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {row.original.docId ?? 'No Doc ID configured'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
              <Badge variant={statusVariant(row.original.status)}>
                {row.original.status}
              </Badge>
            )
          },
          {
            accessorKey: 'refreshedAt',
            header: 'Updated',
            cell: ({ row }) => (
              <span className="text-muted-foreground text-xs">
                {formatDate(row.original.refreshedAt)}
              </span>
            )
          },
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <div className="flex justify-end gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh document source"
                        disabled={refreshMutation.isPending}
                        onClick={() => refreshMutation.mutate(row.original)}
                      >
                        <RefreshCwIcon className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <EditSourceDialog
                        row={row.original}
                        advisorScopes={advisorScopes}
                      />
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )
          }
        ] as ColumnDef<SelectionRow>[]
      }
      data={rows}
      isLoading={isLoading}
      emptyMessage="No document sources configured."
      enableSorting={false}
      enablePagination={false}
    />
  );
}

function LogsTable() {
  const { data, isLoading, error, refetch } = useQuery(
    telemetryQuery({ limit: 100 })
  );
  const events =
    (data as { data: TelemetryEventRow[] } | undefined)?.data?.filter((event) =>
      LOG_EVENTS.has(event.eventName)
    ) ?? [];

  if (error) {
    return (
      <AdminEmptyState
        message="Failed to load refresh history."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <AdminDataTable
      columns={
        [
          {
            accessorKey: 'createdAt',
            header: 'Time',
            cell: ({ row }) => (
              <span className="text-muted-foreground text-xs">
                {formatDate(row.original.createdAt)}
              </span>
            )
          },
          {
            accessorKey: 'eventName',
            header: 'Event',
            cell: ({ row }) => (
              <span className="font-mono text-xs font-medium">
                {row.original.eventName}
              </span>
            )
          },
          {
            id: 'status',
            header: 'Status',
            cell: ({ row }) => {
              const status =
                payloadString(row.original.payload, 'status') ??
                row.original.severity;
              return <Badge variant={statusVariant(status)}>{status}</Badge>;
            }
          },
          {
            id: 'source',
            header: 'Source',
            cell: ({ row }) => {
              const source =
                payloadString(row.original.payload, 'advisorId') ??
                payloadString(row.original.payload, 'sourceId') ??
                payloadString(row.original.payload, 'documentType') ??
                '-';
              return (
                <span className="text-muted-foreground font-mono text-xs">
                  {source}
                </span>
              );
            }
          },
          {
            id: 'detail',
            header: 'Detail',
            cell: ({ row }) => {
              const detail =
                payloadString(row.original.payload, 'code') ??
                payloadString(row.original.payload, 'validationStatus') ??
                payloadString(row.original.payload, 'validationReason') ??
                '-';
              return (
                <span className="text-muted-foreground text-xs">{detail}</span>
              );
            }
          }
        ] as ColumnDef<TelemetryEventRow>[]
      }
      data={events}
      isLoading={isLoading}
      emptyMessage="No document refresh history yet."
      enableSorting={true}
      enablePagination={false}
    />
  );
}

export function KnowledgePanel() {
  useQuery({ ...knowledgeHealthQuery, staleTime: 30_000 });
  const advisorsQuery = useQuery(adminAdvisorsQuery({ limit: 100 }));
  const advisorScopes = [
    'global',
    ...(advisorsQuery.data?.data ?? [])
      .filter((advisor) => advisor.isActive && advisor.status === 'active')
      .map((advisor) => advisor.id)
  ];
  const [activeTab, setActiveTab] = useState<'selections' | 'logs'>(
    'selections'
  );

  return (
    <Card className="flex min-h-[420px] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab('selections')}
            className={cn(
              'border-b-2 px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'selections'
                ? 'border-[#2d6a4f] text-[#2d6a4f]'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            Selections
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              'border-b-2 px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'logs'
                ? 'border-[#2d6a4f] text-[#2d6a4f]'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            Logs
          </button>
        </div>
        {activeTab === 'selections' && (
          <div className="flex items-center gap-3">
            <AddKnowledgeSourceDialog advisorScopes={advisorScopes} />
            <RefreshAllButton />
          </div>
        )}
      </div>
      {activeTab === 'selections' ? (
        <SelectionsTable advisorScopes={advisorScopes} />
      ) : (
        <LogsTable />
      )}
    </Card>
  );
}
