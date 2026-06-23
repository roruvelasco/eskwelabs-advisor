'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
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
  TableRow,
  toast
} from '@eskwelabs-advisor/ui';

import { updateUsageLimits } from '@/lib/domains/admin/api';
import { usageLimitsQuery } from '@/lib/domains/admin/queries';

function formatUsd(value: string | number) {
  return `$${Number(value).toFixed(2)}`;
}

export function LimitsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(usageLimitsQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    maxMessagesPerUserPerDay: 25,
    maxTokensPerUserPerDay: 100000,
    dailyBudgetUsd: '10',
    monthlyBudgetUsd: '300',
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 100
  });

  const limits = data?.data;

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Usage Limits</h2>
          <p className="text-muted-foreground text-sm">
            Platform-wide limits and budget ceilings
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleEdit} size="sm">
              Edit Limits
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
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                size="sm"
              >
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
      </div>

      {limits && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limits Config</CardTitle>
              <CardDescription>
                {limits.config.updatedBy
                  ? `Last updated by ${limits.config.updatedBy}`
                  : 'Using migration defaults'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Max Messages Per User Per Day
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {limits.config.maxMessagesPerUserPerDay}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Max Tokens Per User Per Day
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {limits.config.maxTokensPerUserPerDay.toLocaleString()}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Daily Budget
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(limits.config.dailyBudgetUsd)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Monthly Budget
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(limits.config.monthlyBudgetUsd)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Rate Limit Window
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {limits.config.rateLimitWindowSeconds}s
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground font-medium">
                      Rate Limit Max Requests
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {limits.config.rateLimitMaxRequests}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {limits.status && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Current Spend Status
                </CardTitle>
                <CardDescription>PH time budget consumption</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase tracking-widest">
                      Daily ({limits.status.daily.periodKey})
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatUsd(limits.status.daily.spentUsd)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      of {formatUsd(limits.status.daily.budgetUsd)} budget
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs uppercase tracking-widest">
                      Monthly ({limits.status.monthly.periodKey})
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatUsd(limits.status.monthly.spentUsd)}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      of {formatUsd(limits.status.monthly.budgetUsd)} budget
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
