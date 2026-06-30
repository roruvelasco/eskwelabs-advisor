'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Download } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  userEmail?: string | null;
  dayPh: string;
  messagesToday: number;
  tokensToday: number;
  estimatedSpendTodayUsd: string;
}

interface UserRow {
  id: string;
  email: string;
}

type UsageResponse = {
  data?: UsageCounterRow[];
  meta?: { nextCursor: string | null };
};

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
  const todayPh = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila'
  });
  const [fromDayPh, setFromDayPh] = useState(todayPh);
  const [toDayPh, setToDayPh] = useState(todayPh);
  const [userId, setUserId] = useState('all');
  const [cursor, setCursor] = useState<string | undefined>();
  const [pages, setPages] = useState<UsageCounterRow[]>([]);
  const scopedUserId = userId === 'all' ? undefined : userId;
  const {
    data: countersData,
    isLoading: countersLoading,
    isFetching: countersFetching,
    error: countersError
  } = useQuery(
    usageCountersQuery({
      userId: scopedUserId,
      fromDayPh,
      toDayPh,
      limit: 50,
      cursor
    })
  );
  const { data: usersData, isLoading: usersLoading } = useQuery(usersQuery());

  useEffect(() => {
    setCursor(undefined);
    setPages([]);
  }, [fromDayPh, scopedUserId, toDayPh]);

  useEffect(() => {
    const rows = (countersData as UsageResponse | undefined)?.data;
    if (!rows) return;
    setPages((current) => (cursor ? [...current, ...rows] : rows));
  }, [countersData, cursor]);

  const counters = pages;
  const nextCursor = (countersData as UsageResponse | undefined)?.meta
    ?.nextCursor;
  const users = (usersData as { data: UserRow[] } | undefined)?.data ?? [];
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const isLoading = (countersLoading && counters.length === 0) || usersLoading;

  const totalMessages = counters.reduce(
    (sum, row) => sum + row.messagesToday,
    0
  );
  const totalTokens = counters.reduce((sum, row) => sum + row.tokensToday, 0);
  const totalSpend = counters.reduce(
    (sum, row) => sum + Number(row.estimatedSpendTodayUsd),
    0
  );

  const handleExport = () => {
    const rows = [
      ['User', 'Day', 'Messages', 'Tokens', 'Estimated Spend USD'],
      ...counters.map((row) => [
        row.userEmail ?? emailById.get(row.userId) ?? row.userId,
        row.dayPh,
        String(row.messagesToday),
        String(row.tokensToday),
        row.estimatedSpendTodayUsd
      ])
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `usage-${fromDayPh}-to-${toDayPh}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      <div className="grid gap-3 border-b pb-4 md:grid-cols-[1fr_1fr_1.5fr_auto]">
        <Input
          type="date"
          value={fromDayPh}
          onChange={(event) => setFromDayPh(event.target.value)}
          aria-label="From day"
        />
        <Input
          type="date"
          value={toDayPh}
          onChange={(event) => setToDayPh(event.target.value)}
          aria-label="To day"
        />
        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger>
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={counters.length === 0}
        >
          <Download className="size-4" />
          Export
        </Button>
      </div>

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

      <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-3 px-6 py-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : counters.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12">
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
                      {row.userEmail ??
                        emailById.get(row.userId) ??
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
            {nextCursor && (
              <div className="border-border border-t p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={countersFetching}
                  onClick={() => setCursor(nextCursor)}
                >
                  {countersFetching ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
