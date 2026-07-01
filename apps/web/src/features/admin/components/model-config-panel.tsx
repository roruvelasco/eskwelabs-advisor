'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilIcon } from 'lucide-react';
import { Pie, PieChart, Cell } from 'recharts';

import {
  Badge,
  Button,
  Card,
  CardContent,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast
} from '@eskwelabs-advisor/ui';

import { updateModelConfig } from '@/lib/domains/admin/api';
import type { ModelCatalogResponse } from '@/lib/domains/admin/api';
import {
  modelCatalogQuery,
  modelConfigQuery
} from '@/lib/domains/admin/queries';
import { AdminDataTable } from './admin-data-table';
import type { ColumnDef } from '@tanstack/react-table';

interface ModelConfigRow {
  advisorId: string;
  provider: string;
  model: string;
  isEnabled: boolean;
  updatedBy?: string | null;
  updatedAt: string;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function EditModelDialog({
  row,
  catalog
}: {
  row: ModelConfigRow;
  catalog: ModelCatalogResponse['data']['providers'];
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(row.provider);
  const [model, setModel] = useState(row.model);
  const [isEnabled, setIsEnabled] = useState(row.isEnabled);
  const queryClient = useQueryClient();

  const providerEntry = catalog.find((p) => p.provider === provider);
  const models = providerEntry?.models.map((m) => m.model) ?? [];
  const providerAvailable = Boolean(providerEntry);
  const modelAvailable = providerAvailable && models.includes(model);
  const isStale = !providerAvailable || !modelAvailable;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateModelConfig(row.advisorId, { provider, model, isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'model-config'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'advisors'] });
      queryClient.invalidateQueries({ queryKey: ['advisors'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
      toast.success('Model configuration updated');
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to update model configuration');
    }
  });

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const entry = catalog.find((p) => p.provider === nextProvider);
    setModel(entry?.models[0]?.model ?? '');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit model configuration"
        >
          <PencilIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row.advisorId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isStale && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              The current configuration ({row.provider}/{row.model}) is no
              longer available. Select a new provider and model to save.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`provider-${row.advisorId}`}>Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger
                id={`provider-${row.advisorId}`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((p) => (
                  <SelectItem key={p.provider} value={p.provider}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`model-${row.advisorId}`}>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id={`model-${row.advisorId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((modelOption) => (
                  <SelectItem key={modelOption} value={modelOption}>
                    {modelOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
            <Label htmlFor={`enabled-${row.advisorId}`}>Enabled</Label>
            <Switch
              id={`enabled-${row.advisorId}`}
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={() => mutate()}
            disabled={isPending || !model || isStale}
          >
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModelConfigPanel() {
  const { data, isLoading, error } = useQuery(modelConfigQuery);
  const { data: catalogData } = useQuery(modelCatalogQuery);
  const catalog = useMemo(
    () =>
      (catalogData as ModelCatalogResponse | undefined)?.data?.providers ?? [],
    [catalogData]
  );
  const rows = useMemo(
    () => (data as { data: ModelConfigRow[] } | undefined)?.data ?? [],
    [data]
  );

  const providerLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of catalog) {
      map[p.provider] = p.label;
    }
    return map;
  }, [catalog]);

  const providerData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.provider, (counts.get(row.provider) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([p, count]) => ({
        provider: providerLabelMap[p] ?? p.charAt(0).toUpperCase() + p.slice(1),
        value: count,
        fill: `var(--color-${p})`
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows, providerLabelMap]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        catalog.map((p, i) => [
          p.provider,
          { label: p.label, color: `var(--chart-${(i % 5) + 1})` }
        ])
      ),
    [catalog]
  );

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">
            Failed to load model configuration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-6 pt-6 md:grid-cols-[280px_1fr]">
          <div className="flex flex-col items-center">
            <ChartContainer
              config={chartConfig}
              className="aspect-square h-[220px] w-[220px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={providerData}
                  dataKey="value"
                  nameKey="provider"
                  innerRadius={70}
                  outerRadius={105}
                  strokeWidth={2}
                >
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
              {providerData.map((item) => (
                <div key={item.provider} className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground">{item.provider}</span>
                  <span className="font-semibold tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <AdminDataTable
              columns={
                [
                  {
                    accessorKey: 'advisorId',
                    header: 'Advisor',
                    cell: ({ row }) => (
                      <span className="font-medium">
                        {row.original.advisorId}
                      </span>
                    )
                  },
                  {
                    accessorKey: 'provider',
                    header: 'Provider',
                    cell: ({ row }) => (
                      <span className="capitalize">
                        {row.original.provider}
                      </span>
                    )
                  },
                  {
                    accessorKey: 'model',
                    header: 'Model',
                    cell: ({ row }) => (
                      <span className="font-mono text-xs">
                        {row.original.model}
                      </span>
                    )
                  },
                  {
                    accessorKey: 'isEnabled',
                    header: 'Status',
                    cell: ({ row }) => (
                      <Badge
                        variant={
                          row.original.isEnabled ? 'default' : 'destructive'
                        }
                      >
                        {row.original.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    )
                  },
                  {
                    accessorKey: 'updatedAt',
                    header: 'Last Updated',
                    cell: ({ row }) => (
                      <span className="text-muted-foreground text-xs">
                        {formatDate(row.original.updatedAt)}
                      </span>
                    )
                  },
                  {
                    id: 'actions',
                    header: '',
                    cell: ({ row }) => (
                      <div className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <EditModelDialog
                                row={row.original}
                                catalog={catalog}
                              />
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    )
                  }
                ] as ColumnDef<ModelConfigRow>[]
              }
              data={rows}
              isLoading={isLoading}
              emptyMessage="No model configuration rows found."
              enableSorting={true}
              enablePagination={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
