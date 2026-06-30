'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from 'recharts';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip as ShadcnChartTooltip,
  ChartTooltipContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from '@eskwelabs-advisor/ui';

import {
  advisorBreakdownQuery,
  usageCountersQuery,
  usageLimitsQuery,
  usageSummaryQuery,
  usersQuery
} from '@/lib/domains/admin/queries';
import { AdminDataTable } from './admin-data-table';
import type { ColumnDef } from '@tanstack/react-table';

import { AdminKpiCard } from './admin-kpi-card';

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

interface AdvisorBreakdownItem {
  advisorId: string;
  messages: number;
  tokens: number;
  estimatedSpendUsd: string;
}

type UsageResponse = {
  data?: UsageCounterRow[];
  meta?: { nextCursor: string | null };
};

function phToday() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila'
  });
}

function addDays(dayPh: string, days: number) {
  const [year, month, day] = dayPh.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatUsd(value: string | number, digits = 4) {
  return `$${Number(value).toFixed(digits)}`;
}

function BudgetHealth({
  title,
  spent,
  budget
}: {
  title: string;
  spent: string;
  budget: string;
}) {
  const spentNumber = Number(spent);
  const budgetNumber = Number(budget);
  const percentage =
    budgetNumber > 0 ? Math.min((spentNumber / budgetNumber) * 100, 100) : 0;
  const status =
    percentage >= 80
      ? 'destructive'
      : percentage >= 50
        ? 'secondary'
        : 'outline';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <Badge variant={status}>{Math.round(percentage)}%</Badge>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {formatUsd(spentNumber, 2)} of {formatUsd(budgetNumber, 2)}
      </p>
    </div>
  );
}

const ADVISOR_LABELS: Record<string, string> = {
  'data-dashboard': 'Data Dashboard',
  'ssot-memo': 'SSOT Memo',
  'data-modeling': 'Data Modeling'
};

function AdvisorBreakdownChart({
  data,
  isLoading
}: {
  data: AdvisorBreakdownItem[];
  isLoading: boolean;
}) {
  const chartData = useMemo(() => {
    const colors = [
      'var(--chart-1)',
      'var(--chart-2)',
      'var(--chart-3)',
      'var(--chart-4)'
    ];
    return data.map((item, i) => ({
      advisor: ADVISOR_LABELS[item.advisorId] ?? item.advisorId,
      value: Number(item.estimatedSpendUsd),
      fill: colors[i % colors.length]
    }));
  }, [data]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        chartData.map((d, i) => [
          `advisor-${i}`,
          { label: d.advisor, color: d.fill }
        ])
      ),
    [chartData]
  );

  if (isLoading) {
    return <Skeleton className="h-[320px] w-full" />;
  }

  if (chartData.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No messages recorded for this range.
      </p>
    );
  }

  const totalSpend = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <ChartContainer
        config={chartConfig}
        className="aspect-square h-[220px] w-[220px]"
      >
        <PieChart>
          <ShadcnChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="advisor"
            innerRadius={70}
            outerRadius={105}
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex items-baseline gap-2">
        <p className="font-serif text-2xl font-bold text-[#2d6a4f]">
          {formatUsd(totalSpend, 2)}
        </p>
        <p className="text-muted-foreground text-xs">total</p>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        {chartData.map((item) => (
          <div key={item.advisor} className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-muted-foreground max-w-[120px] truncate">
              {item.advisor}
            </span>
            <span className="font-semibold tabular-nums">
              {formatUsd(item.value, 2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsagePanel() {
  const todayPh = phToday();
  const [fromDayPh, setFromDayPh] = useState(addDays(todayPh, -29));
  const [toDayPh, setToDayPh] = useState(todayPh);
  const [userId, setUserId] = useState('all');
  const [cursor, setCursor] = useState<string | undefined>();
  const [pages, setPages] = useState<UsageCounterRow[]>([]);
  const scopedUserId = userId === 'all' ? undefined : userId;

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError
  } = useQuery(
    usageSummaryQuery({
      userId: scopedUserId,
      fromDayPh,
      toDayPh,
      topUsersLimit: 5
    })
  );
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
  const { data: limitsData, isLoading: limitsLoading } =
    useQuery(usageLimitsQuery);
  const { data: advisorData, isLoading: advisorLoading } = useQuery(
    advisorBreakdownQuery({ fromDayPh, toDayPh })
  );

  useEffect(() => {
    setCursor(undefined);
    setPages([]);
  }, [fromDayPh, scopedUserId, toDayPh]);

  useEffect(() => {
    const rows = (countersData as UsageResponse | undefined)?.data;
    if (!rows) return;
    setPages((current) => (cursor ? [...current, ...rows] : rows));
  }, [countersData, cursor]);

  const summary = summaryData?.data;
  const counters = pages;
  const nextCursor = (countersData as UsageResponse | undefined)?.meta
    ?.nextCursor;
  const users = (usersData as { data: UserRow[] } | undefined)?.data ?? [];
  const advisorBreakdown =
    (advisorData as { data: AdvisorBreakdownItem[] } | undefined)?.data ?? [];
  const emailById = new Map(users.map((user) => [user.id, user.email]));
  const isTableLoading =
    (countersLoading && counters.length === 0) || usersLoading;
  const chartData = useMemo(
    () =>
      summary?.days.map((day) => ({
        day: day.dayPh.slice(5),
        spend: Number(day.estimatedSpendUsd),
        messages: day.messages,
        tokens: day.tokens
      })) ?? [],
    [summary]
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

  if (summaryError || countersError) {
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

      <div className="grid shrink-0 grid-cols-2 gap-3 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          label="Messages"
          value={summary?.totals.messages.toLocaleString() ?? 0}
          isLoading={summaryLoading}
        />
        <AdminKpiCard
          label="Tokens"
          value={summary?.totals.tokens.toLocaleString() ?? 0}
          isLoading={summaryLoading}
        />
        <AdminKpiCard
          label="Estimated Spend"
          value={formatUsd(summary?.totals.estimatedSpendUsd ?? 0, 2)}
          isLoading={summaryLoading}
        />
        <AdminKpiCard
          label="Active Users"
          value={summary?.totals.activeUsers.toLocaleString() ?? 0}
          isLoading={summaryLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Usage Trend</CardTitle>
            <CardDescription>
              Messages, tokens, and spend by PH calendar day.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pb-6">
            {summaryLoading ? (
              <Skeleton className="w-full flex-1" />
            ) : chartData.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  No usage recorded for this range.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
                      <defs>
                        <linearGradient
                          id="spendGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--chart-2)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--chart-2)"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        minTickGap={20}
                      />
                      <YAxis
                        yAxisId="spend"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `$${Number(value).toFixed(2)}`
                        }
                        width={48}
                      />
                      <YAxis yAxisId="activity" hide />
                      <ChartTooltip
                        cursor={{ stroke: 'var(--border)' }}
                        formatter={(value, name) => {
                          if (name === 'spend') {
                            return [formatUsd(Number(value)), 'Spend'];
                          }
                          if (name === 'tokens') {
                            return [Number(value).toLocaleString(), 'Tokens'];
                          }
                          return [Number(value).toLocaleString(), 'Messages'];
                        }}
                      />
                      <Area
                        yAxisId="spend"
                        type="monotone"
                        dataKey="spend"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        fill="url(#spendGradient)"
                      />
                      <Area
                        yAxisId="activity"
                        type="monotone"
                        dataKey="tokens"
                        stroke="var(--chart-1)"
                        strokeWidth={1.5}
                        fill="transparent"
                      />
                      <Area
                        yAxisId="activity"
                        type="monotone"
                        dataKey="messages"
                        stroke="var(--chart-3)"
                        strokeWidth={1.5}
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)]" />
                    <span className="text-muted-foreground">Spend</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1)]" />
                    <span className="text-muted-foreground">Tokens</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-3)]" />
                    <span className="text-muted-foreground">Messages</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Health</CardTitle>
              <CardDescription>
                Current global spend against caps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {limitsLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : limitsData?.data.status ? (
                <>
                  <BudgetHealth
                    title={`Daily (${limitsData.data.status.daily.periodKey})`}
                    spent={limitsData.data.status.daily.spentUsd}
                    budget={limitsData.data.status.daily.budgetUsd}
                  />
                  <BudgetHealth
                    title={`Monthly (${limitsData.data.status.monthly.periodKey})`}
                    spent={limitsData.data.status.monthly.spentUsd}
                    budget={limitsData.data.status.monthly.budgetUsd}
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Budget status is not available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advisor Breakdown</CardTitle>
              <CardDescription>
                Spend distribution across advisors in this range.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdvisorBreakdownChart
                data={advisorBreakdown}
                isLoading={advisorLoading}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Users</CardTitle>
          <CardDescription>
            Highest estimated spend in this range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            columns={
              [
                {
                  id: 'user',
                  header: 'User',
                  cell: ({ row }) => (
                    <span className="font-medium">
                      {row.original.userEmail ??
                        emailById.get(row.original.userId) ??
                        `${row.original.userId.slice(0, 8)}...`}
                    </span>
                  )
                },
                {
                  accessorKey: 'messages',
                  header: 'Messages',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {row.original.messages.toLocaleString()}
                    </span>
                  )
                },
                {
                  accessorKey: 'tokens',
                  header: 'Tokens',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {row.original.tokens.toLocaleString()}
                    </span>
                  )
                },
                {
                  accessorKey: 'estimatedSpendUsd',
                  header: 'Est. Spend',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {formatUsd(row.original.estimatedSpendUsd)}
                    </span>
                  )
                }
              ] as ColumnDef<{
                userId: string;
                userEmail?: string | null;
                messages: number;
                tokens: number;
                estimatedSpendUsd: string;
              }>[]
            }
            data={summary?.topUsers ?? []}
            isLoading={summaryLoading}
            emptyMessage="No users recorded for this range."
            enableSorting={true}
            enablePagination={false}
          />
        </CardContent>
      </Card>

      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="text-base">Detailed Usage</CardTitle>
          <CardDescription>Daily per-user usage counters.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col p-0">
          <AdminDataTable
            columns={
              [
                {
                  id: 'user',
                  header: 'User',
                  cell: ({ row }) => (
                    <span className="font-medium">
                      {row.original.userEmail ??
                        emailById.get(row.original.userId) ??
                        `${row.original.userId.slice(0, 8)}...`}
                    </span>
                  )
                },
                {
                  accessorKey: 'dayPh',
                  header: 'Day',
                  cell: ({ row }) => (
                    <span className="text-muted-foreground text-sm">
                      {row.original.dayPh}
                    </span>
                  )
                },
                {
                  accessorKey: 'messagesToday',
                  header: 'Messages',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {row.original.messagesToday.toLocaleString()}
                    </span>
                  )
                },
                {
                  accessorKey: 'tokensToday',
                  header: 'Tokens',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {row.original.tokensToday.toLocaleString()}
                    </span>
                  )
                },
                {
                  accessorKey: 'estimatedSpendTodayUsd',
                  header: 'Est. Spend',
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {formatUsd(row.original.estimatedSpendTodayUsd)}
                    </span>
                  )
                }
              ] as ColumnDef<UsageCounterRow>[]
            }
            data={counters}
            isLoading={isTableLoading}
            emptyMessage="No usage recorded for this range."
            enableSorting={true}
            enablePagination={false}
          />
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
        </CardContent>
      </Card>
    </div>
  );
}
