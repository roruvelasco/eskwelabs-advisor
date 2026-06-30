'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@eskwelabs-advisor/ui';

import { telemetryQuery } from '@/lib/domains/admin/queries';

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

export function TelemetryPanel() {
  const { data, isLoading, error, refetch } = useQuery(telemetryQuery());

  const events =
    (data as { data: TelemetryEventRow[] } | undefined)?.data ?? [];

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
        {isLoading ? (
          <div className="space-y-3 px-8 py-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No events recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead className="pl-6">Event</SortHead>
                  <SortHead>Status</SortHead>
                  <SortHead>User</SortHead>
                  <SortHead>Detail</SortHead>
                  <SortHead>Timestamp</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="py-4 pl-6 text-xs font-medium">
                      {EVENT_LABELS[event.eventName] ?? event.eventName}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant={statusVariant(event.severity)}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-4 text-xs">
                      {extractUser(event.payload)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs py-4 text-xs">
                      {extractDetail(event.payload)}
                    </TableCell>
                    <TableCell className="text-muted-foreground py-4 pr-6 text-xs">
                      {formatDate(event.createdAt)}
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
