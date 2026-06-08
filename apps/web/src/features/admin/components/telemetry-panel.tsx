'use client';

import { useQuery } from '@tanstack/react-query';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

function actorLabel(actorId: string | null) {
  if (!actorId) return '-';
  return actorId.length > 8 ? `${actorId.slice(0, 8)}...` : actorId;
}

export function TelemetryPanel() {
  const { data, isLoading, error, refetch } = useQuery({
    ...telemetryQuery,
    refetchInterval: 10_000
  });

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Event Log</CardTitle>
        <span className="text-muted-foreground text-xs">10 sec refresh</span>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 px-6 pb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground px-6 pb-6 text-sm">
            No events recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Payload</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {event.eventName}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANTS[event.severity]}>
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {actorLabel(event.actorId)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <pre className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap text-xs">
                        {JSON.stringify(event.payload)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
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
