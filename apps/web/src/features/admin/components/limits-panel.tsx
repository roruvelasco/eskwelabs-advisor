'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, PencilIcon } from 'lucide-react';

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast
} from '@eskwelabs-advisor/ui';

import type {
  UsageLimitConfigSnapshot,
  UsageLimitsReviewResponse
} from '@/lib/domains/admin/api';
import { updateUsageLimits } from '@/lib/domains/admin/api';
import {
  usageLimitsQuery,
  usageLimitsReviewQuery
} from '@/lib/domains/admin/queries';

import { AdminKpiCard } from './admin-kpi-card';

type LimitReview = UsageLimitsReviewResponse['data'];

type PolicyRow = {
  label: string;
  limit: string;
  observed: string;
  percent: number | null;
  intent: string;
};

const configLabels: Record<keyof UsageLimitConfigSnapshot, string> = {
  maxMessagesPerUserPerDay: 'Messages / user / day',
  maxTokensPerUserPerDay: 'Tokens / user / day',
  dailyBudgetUsd: 'Daily budget',
  monthlyBudgetUsd: 'Monthly budget',
  rateLimitWindowSeconds: 'Rate window',
  rateLimitMaxRequests: 'Rate max requests'
};

function formatUsd(value: string | number, digits = 2) {
  return `$${Number(value).toFixed(digits)}`;
}

function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function formatConfigValue(
  key: keyof UsageLimitConfigSnapshot,
  value: string | number
) {
  if (key === 'dailyBudgetUsd' || key === 'monthlyBudgetUsd') {
    return formatUsd(value);
  }
  if (key === 'rateLimitWindowSeconds') return `${value}s`;
  return Number(value).toLocaleString();
}

function percent(used: number, limit: number) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }
  return Math.min((used / limit) * 100, 100);
}

function statusVariant(value: number | null) {
  if (value === null) return 'outline';
  if (value >= 90) return 'destructive';
  if (value >= 70) return 'secondary';
  return 'outline';
}

function statusLabel(value: number | null) {
  if (value === null) return 'No budget';
  if (value >= 90) return 'Tight';
  if (value >= 70) return 'Watch';
  return 'Healthy';
}

function changedFields(
  previousConfig: UsageLimitConfigSnapshot | null,
  nextConfig: UsageLimitConfigSnapshot
) {
  return (Object.keys(configLabels) as Array<keyof UsageLimitConfigSnapshot>)
    .filter((key) => previousConfig?.[key] !== nextConfig[key])
    .map((key) => ({
      key,
      label: configLabels[key],
      previous: previousConfig
        ? formatConfigValue(key, previousConfig[key])
        : 'Not set',
      next: formatConfigValue(key, nextConfig[key])
    }));
}

function LimitsEditDialog() {
  const queryClient = useQueryClient();
  const { data } = useQuery(usageLimitsQuery);
  const [open, setOpen] = useState(false);
  const limits = data?.data;
  const [form, setForm] = useState({
    maxMessagesPerUserPerDay: 25,
    maxTokensPerUserPerDay: 100000,
    dailyBudgetUsd: '10',
    monthlyBudgetUsd: '300',
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 100
  });

  const mutation = useMutation({
    mutationFn: updateUsageLimits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage-limits'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'usage-limits-review']
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage-counters'] });
      toast('Limits updated');
      setOpen(false);
    },
    onError: () => toast('Failed to update limits')
  });

  const handleEdit = () => {
    if (limits) {
      setForm({
        maxMessagesPerUserPerDay: limits.config.maxMessagesPerUserPerDay,
        maxTokensPerUserPerDay: limits.config.maxTokensPerUserPerDay,
        dailyBudgetUsd: limits.config.dailyBudgetUsd,
        monthlyBudgetUsd: limits.config.monthlyBudgetUsd,
        rateLimitWindowSeconds: limits.config.rateLimitWindowSeconds,
        rateLimitMaxRequests: limits.config.rateLimitMaxRequests
      });
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEdit}
          aria-label="Edit limits"
        >
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Usage Limits</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Messages/Day</Label>
              <Input
                type="number"
                value={form.maxMessagesPerUserPerDay}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxMessagesPerUserPerDay: Number(e.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tokens/Day</Label>
              <Input
                type="number"
                value={form.maxTokensPerUserPerDay}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxTokensPerUserPerDay: Number(e.target.value)
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily Budget (USD)</Label>
              <Input
                type="text"
                value={form.dailyBudgetUsd}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    dailyBudgetUsd: e.target.value
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Budget (USD)</Label>
              <Input
                type="text"
                value={form.monthlyBudgetUsd}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    monthlyBudgetUsd: e.target.value
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rate Window (s)</Label>
              <Input
                type="number"
                value={form.rateLimitWindowSeconds}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rateLimitWindowSeconds: Number(e.target.value)
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Max Requests</Label>
              <Input
                type="number"
                value={form.rateLimitMaxRequests}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    rateLimitMaxRequests: Number(e.target.value)
                  }))
                }
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending}
            size="sm"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LimitsEditButton() {
  return <LimitsEditDialog />;
}

function PolicyCalibration({ review }: { review: LimitReview }) {
  const { config, policy, status, enforcement } = review;
  const rows: PolicyRow[] = [
    {
      label: 'Messages per user per day',
      limit: config.maxMessagesPerUserPerDay.toLocaleString(),
      observed: `${policy.metrics.peakMessagesPerUserPerDay.toLocaleString()} peak`,
      percent: percent(
        policy.metrics.peakMessagesPerUserPerDay,
        config.maxMessagesPerUserPerDay
      ),
      intent: 'Daily conversation cap'
    },
    {
      label: 'Tokens per user per day',
      limit: config.maxTokensPerUserPerDay.toLocaleString(),
      observed: `${policy.metrics.peakTokensPerUserPerDay.toLocaleString()} peak`,
      percent: percent(
        policy.metrics.peakTokensPerUserPerDay,
        config.maxTokensPerUserPerDay
      ),
      intent: 'Daily token cap'
    },
    {
      label: 'Daily budget',
      limit: formatUsd(config.dailyBudgetUsd),
      observed: `${formatUsd(status.daily.spentUsd)} spent`,
      percent: percent(
        Number(status.daily.spentUsd),
        Number(config.dailyBudgetUsd)
      ),
      intent: status.daily.periodKey
    },
    {
      label: 'Monthly budget',
      limit: formatUsd(config.monthlyBudgetUsd),
      observed: `${formatUsd(status.monthly.spentUsd)} spent`,
      percent: percent(
        Number(status.monthly.spentUsd),
        Number(config.monthlyBudgetUsd)
      ),
      intent: status.monthly.periodKey
    },
    {
      label: 'Rate limit',
      limit: `${config.rateLimitMaxRequests.toLocaleString()} requests / ${config.rateLimitWindowSeconds}s`,
      observed: `${enforcement.counts.rate.toLocaleString()} blocks`,
      percent: null,
      intent: 'Admin/API request throttle'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-base">Policy Calibration</CardTitle>
          <CardDescription>
            Recent pressure from {policy.range.fromDayPh} to{' '}
            {policy.range.toDayPh}, PH time.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Policy</TableHead>
                <TableHead>Configured Limit</TableHead>
                <TableHead>Recent Pressure</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="py-4 pl-6">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {row.intent}
                    </p>
                  </TableCell>
                  <TableCell className="py-4 font-semibold tabular-nums">
                    {row.limit}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="space-y-1.5">
                      <p className="text-sm tabular-nums">{row.observed}</p>
                      {row.percent !== null && (
                        <div className="bg-muted h-2 w-44 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${row.percent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 pr-6">
                    <Badge variant={statusVariant(row.percent)}>
                      {statusLabel(row.percent)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EnforcementPressure({ review }: { review: LimitReview }) {
  const counts = review.enforcement.counts;
  const cards = [
    { label: 'Rate blocks', value: counts.rate, detail: 'Request throttle' },
    { label: 'Cap blocks', value: counts.cap, detail: 'Message/token caps' },
    {
      label: 'Budget blocks',
      value: counts.budget,
      detail: 'Spend guardrails'
    },
    { label: 'Other blocks', value: counts.other, detail: 'Unclassified' }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-base">Enforcement Pressure</CardTitle>
          <CardDescription>
            Blocks recorded since {formatDate(review.enforcement.since)}.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Block Type</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.label}>
                  <TableCell className="py-4 pl-6 font-medium">
                    {card.label}
                  </TableCell>
                  <TableCell className="py-4 font-semibold tabular-nums">
                    {card.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-4 text-sm">
                    {card.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeHistory({ review }: { review: LimitReview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change History</CardTitle>
        <CardDescription>
          Durable audit events for limit edits recorded after this release.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {review.auditEvents.length === 0 ? (
          <div className="flex items-center gap-3 px-6 py-8">
            <AlertTriangleIcon className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-sm">
              No limit changes recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Changed</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Values</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {review.auditEvents.map((event) => {
                  const fields = changedFields(
                    event.previousConfig,
                    event.nextConfig
                  );
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="text-muted-foreground py-4 pl-6 text-sm">
                        {formatDate(event.createdAt)}
                      </TableCell>
                      <TableCell className="py-4 font-medium">
                        {event.changedByEmail ??
                          event.changedBy ??
                          'Unknown admin'}
                      </TableCell>
                      <TableCell className="py-4 pr-6">
                        <div className="flex flex-wrap gap-2">
                          {fields.length === 0 ? (
                            <Badge variant="outline">No value changes</Badge>
                          ) : (
                            fields.map((field) => (
                              <Badge key={field.key} variant="outline">
                                {field.label}: {field.previous} → {field.next}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LimitsPanel() {
  const { data, isLoading, error } = useQuery(usageLimitsReviewQuery);
  const review = data?.data;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">Failed to load limits.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !review) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard
          label="Daily Remaining"
          value={formatUsd(review.status.daily.remainingUsd)}
          description={`${formatUsd(review.status.daily.spentUsd)} spent today`}
          isLoading={false}
        />
        <AdminKpiCard
          label="Monthly Remaining"
          value={formatUsd(review.status.monthly.remainingUsd)}
          description={`${formatUsd(review.status.monthly.spentUsd)} spent this month`}
          isLoading={false}
        />
        <AdminKpiCard
          label="Recent Tokens"
          value={review.policy.metrics.totalTokens.toLocaleString()}
          description="Last 7 PH calendar days"
          isLoading={false}
        />
        <AdminKpiCard
          label="Last Updated"
          value={formatDate(review.config.updatedAt)}
          description={review.config.updatedBy ?? 'No admin recorded'}
          isLoading={false}
        />
      </div>

      <PolicyCalibration review={review} />
      <EnforcementPressure review={review} />
      <ChangeHistory review={review} />
    </div>
  );
}
