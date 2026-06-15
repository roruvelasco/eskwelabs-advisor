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

const SEVERITY_VARIANTS: Record<
  TelemetryEventRow['severity'],
  'default' | 'outline' | 'secondary' | 'destructive'
> = {
  info: 'secondary',
  warning: 'outline',
  error: 'destructive'
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

function actorLabel(actorId: string | null) {
  if (!actorId) return '—';
  return actorId.length > 8 ? `${actorId.slice(0, 8)}...` : actorId;
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
                  <SortHead>Severity</SortHead>
                  <SortHead>Actor</SortHead>
                  <SortHead>Payload</SortHead>
                  <SortHead>Timestamp</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="py-4 pl-6 font-mono text-xs font-medium">
                      {event.eventName}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant={SEVERITY_VARIANTS[event.severity]}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs">
                      {actorLabel(event.actorId)}
                    </TableCell>
                    <TableCell className="max-w-xs py-4">
                      <pre className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                        {JSON.stringify(event.payload)}
                      </pre>
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
