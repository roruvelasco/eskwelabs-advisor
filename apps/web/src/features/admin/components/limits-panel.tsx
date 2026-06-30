'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
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
  toast
} from '@eskwelabs-advisor/ui';

import { updateUsageLimits } from '@/lib/domains/admin/api';
import { usageLimitsQuery } from '@/lib/domains/admin/queries';

function formatUsd(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

function LimitsCard({
  title,
  items
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">{item.label}</span>
            <span className="text-sm font-semibold tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LimitsEditButton() {
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
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

function SpendCard({
  title,
  spent,
  budget
}: {
  title: string;
  spent: number;
  budget: number;
}) {
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const barColor =
    percentage >= 80
      ? 'bg-red-500'
      : percentage >= 50
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">
          {formatUsd(spent)}
        </p>
        <div className="space-y-1.5">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {formatUsd(budget)} budget
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LimitsPanel() {
  const { data, isLoading } = useQuery(usageLimitsQuery);
  const limits = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {limits && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LimitsCard
              title="Usage caps"
              items={[
                {
                  label: 'Max messages per user per day',
                  value: limits.config.maxMessagesPerUserPerDay.toString()
                },
                {
                  label: 'Max tokens per user per day',
                  value: limits.config.maxTokensPerUserPerDay.toLocaleString()
                }
              ]}
            />
            <LimitsCard
              title="Budget"
              items={[
                {
                  label: 'Daily budget',
                  value: formatUsd(limits.config.dailyBudgetUsd)
                },
                {
                  label: 'Monthly budget',
                  value: formatUsd(limits.config.monthlyBudgetUsd)
                }
              ]}
            />
            <LimitsCard
              title="Rate limit"
              items={[
                {
                  label: 'Rate limit window',
                  value: `${limits.config.rateLimitWindowSeconds}s`
                },
                {
                  label: 'Rate limit max requests',
                  value: limits.config.rateLimitMaxRequests.toString()
                }
              ]}
            />
          </div>

          {limits.status && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SpendCard
                title={`Daily Spend (${limits.status.daily.periodKey})`}
                spent={Number(limits.status.daily.spentUsd)}
                budget={Number(limits.status.daily.budgetUsd)}
              />
              <SpendCard
                title={`Monthly Spend (${limits.status.monthly.periodKey})`}
                spent={Number(limits.status.monthly.spentUsd)}
                budget={Number(limits.status.monthly.budgetUsd)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
