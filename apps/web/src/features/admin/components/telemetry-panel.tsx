'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Card,
  CardContent
} from '@eskwelabs-advisor/ui';

import { telemetryQuery } from '@/lib/domains/admin/queries';
import { AdminDataTable } from './admin-data-table';
import type { ColumnDef } from '@tanstack/react-table';

interface TelemetryEventRow {
  id: string;
  eventName: string;
  actorId: string | null;
  severity: 'info' | 'warning' | 'error';
  payload: Record<string, unknown>;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  login_success: 'Login',
  login_denied: 'Login denied',
  advisor_selected: 'Advisor selected',
  conversation_resumed: 'Conversation resumed',
  message_sent: 'Message sent',
  llm_call_started: 'LLM call started',
  llm_call_completed: 'LLM completed',
  request_blocked: 'Request blocked',
  prompt_cache_hit: 'Prompt cache hit',
  prompt_cache_miss: 'Prompt cache miss',
  dna_digest_regenerated: 'DNA digest regenerated',
  doc_fetch_error: 'Doc fetch error',
  provider_error: 'Provider error',
  supabase_write_error: 'DB write error',
  admin_model_changed: 'Model changed',
  admin_cache_refresh: 'Cache refreshed'
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

function extractUser(payload: Record<string, unknown>) {
  const email = payload.email;
  if (typeof email === 'string') return email;
  return '—';
}

function extractDetail(payload: Record<string, unknown>) {
  const parts: string[] = [];
  if (typeof payload.advisorId === 'string') parts.push(payload.advisorId);
  if (typeof payload.model === 'string') parts.push(payload.model);
  if (typeof payload.reason === 'string') parts.push(payload.reason);
  if (typeof payload.status === 'string') parts.push(payload.status);
  if (typeof payload.error === 'string') parts.push(payload.error.slice(0, 80));
  if (typeof payload.provider === 'string') parts.push(payload.provider);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function statusVariant(severity: TelemetryEventRow['severity']) {
  if (severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'outline' as const;
  return 'secondary' as const;
}

export function TelemetryPanel() {
  const { data, isLoading, error, refetch } = useQuery(telemetryQuery());

  const events = useMemo(
    () => (data as { data: TelemetryEventRow[] } | undefined)?.data ?? [],
    [data]
  );

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-6">
          <p className="text-destructive text-sm">
            Failed to load telemetry events.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col p-0">
        <AdminDataTable
          columns={
            [
              {
                accessorKey: 'eventName',
                header: 'Event',
                cell: ({ row }) => (
                  <span className="text-xs font-medium">
                    {EVENT_LABELS[row.original.eventName] ??
                      row.original.eventName}
                  </span>
                )
              },
              {
                accessorKey: 'severity',
                header: 'Status',
                cell: ({ row }) => (
                  <Badge variant={statusVariant(row.original.severity)}>
                    {row.original.severity}
                  </Badge>
                )
              },
              {
                id: 'user',
                header: 'User',
                cell: ({ row }) => (
                  <span className="text-muted-foreground text-xs">
                    {extractUser(row.original.payload)}
                  </span>
                )
              },
              {
                id: 'detail',
                header: 'Detail',
                cell: ({ row }) => (
                  <span className="text-muted-foreground max-w-xs text-xs">
                    {extractDetail(row.original.payload)}
                  </span>
                )
              },
              {
                accessorKey: 'createdAt',
                header: 'Timestamp',
                cell: ({ row }) => (
                  <span className="text-muted-foreground text-xs">
                    {formatDate(row.original.createdAt)}
                  </span>
                )
              }
            ] as ColumnDef<TelemetryEventRow>[]
          }
          data={events}
          isLoading={isLoading}
          emptyMessage="No events recorded yet."
          enableSorting={true}
          enablePagination={true}
          pageSize={20}
        />
      </CardContent>
    </Card>
  );
}
