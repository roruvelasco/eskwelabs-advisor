'use client';

import { useQuery } from '@tanstack/react-query';

import {
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

import { usageCountersQuery, usersQuery } from '@/lib/domains/admin/queries';

interface UsageCounterRow {
  userId: string;
  dayPh: string;
  messagesToday: number;
  tokensToday: number;
  estimatedSpendTodayUsd: string;
}

interface UserRow {
  id: string;
  email: string;
}

function StatCard({
  label,
  value,
  loading
}: {
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function UsagePanel() {
  const {
    data: countersData,
    isLoading: countersLoading,
    error: countersError
  } = useQuery(usageCountersQuery);
  const { data: usersData, isLoading: usersLoading } = useQuery(usersQuery);

  const counters =
    (countersData as { data: UsageCounterRow[] } | undefined)?.data ?? [];
  const users = (usersData as { data: UserRow[] } | undefined)?.data ?? [];
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const isLoading = countersLoading || usersLoading;

  const totalMessages = counters.reduce(
    (sum, row) => sum + row.messagesToday,
    0
  );
  const totalTokens = counters.reduce((sum, row) => sum + row.tokensToday, 0);
  const totalSpend = counters.reduce(
    (sum, row) => sum + Number(row.estimatedSpendTodayUsd),
    0
  );

  if (countersError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">Failed to load usage data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Messages Today"
          value={totalMessages.toLocaleString()}
          loading={isLoading}
        />
        <StatCard
          label="Tokens Today"
          value={totalTokens.toLocaleString()}
          loading={isLoading}
        />
        <StatCard
          label="Est. Spend Today"
          value={`$${totalSpend.toFixed(4)}`}
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-User Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 px-6 pb-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : counters.length === 0 ? (
            <p className="text-muted-foreground px-6 pb-6 text-sm">
              No usage recorded for today.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Est. Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counters.map((row) => (
                    <TableRow key={`${row.userId}-${row.dayPh}`}>
                      <TableCell className="font-mono text-xs">
                        {emailById.get(row.userId) ??
                          `${row.userId.slice(0, 8)}...`}
                      </TableCell>
                      <TableCell>{row.dayPh}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.messagesToday.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.tokensToday.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${Number(row.estimatedSpendTodayUsd).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
