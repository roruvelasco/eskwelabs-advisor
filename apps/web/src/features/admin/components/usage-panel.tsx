'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
        <CardDescription className="text-xs uppercase tracking-widest">
          {label}
        </CardDescription>
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

function SortHead({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className ?? ''}>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
        {children}
        <ChevronsUpDown className="text-muted-foreground/40 size-3 shrink-0" />
      </span>
    </TableHead>
  );
}

export function UsagePanel() {
  const {
    data: countersData,
    isLoading: countersLoading,
    error: countersError
  } = useQuery(usageCountersQuery());
  const { data: usersData, isLoading: usersLoading } = useQuery(usersQuery());

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
    <div className="flex flex-1 flex-col gap-6">
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
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

      <Card className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col p-0">
          {isLoading ? (
            <div className="space-y-3 px-8 py-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : counters.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-muted-foreground text-sm">
                No usage recorded for today.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead className="pl-6">User</SortHead>
                    <SortHead>Day</SortHead>
                    <SortHead>Messages</SortHead>
                    <SortHead>Tokens</SortHead>
                    <SortHead>Est. Spend</SortHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counters.map((row) => (
                    <TableRow key={`${row.userId}-${row.dayPh}`}>
                      <TableCell className="py-4 pl-6 font-medium">
                        {emailById.get(row.userId) ??
                          `${row.userId.slice(0, 8)}...`}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {row.dayPh}
                      </TableCell>
                      <TableCell className="py-4 tabular-nums">
                        {row.messagesToday.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 tabular-nums">
                        {row.tokensToday.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 pr-6 tabular-nums">
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
