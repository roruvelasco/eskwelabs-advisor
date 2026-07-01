'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2Icon,
  CirclePauseIcon,
  PencilIcon,
  PlusIcon,
  PlayIcon,
  XCircleIcon
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast
} from '@eskwelabs-advisor/ui';

import type {
  AdminAdvisor,
  CreateAdvisorInput,
  ModelCatalogResponse,
  UpdateAdvisorInput
} from '@/lib/domains/admin/api';
import {
  createAdvisor,
  deleteAdvisor,
  publishAdvisor,
  updateAdvisor
} from '@/lib/domains/admin/api';
import {
  adminAdvisorsQuery,
  modelCatalogQuery
} from '@/lib/domains/admin/queries';
import { AdminDataTable } from './admin-data-table';

function formatDate(iso: string | null) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function shortValue(value: string | null) {
  if (!value) return 'Not set';
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function statusVariant(row: AdminAdvisor) {
  if (!row.isActive || row.status === 'disabled') return 'destructive' as const;
  if (row.availability?.status === 'available') return 'default' as const;
  return 'secondary' as const;
}

function readinessLabel(row: AdminAdvisor) {
  if (!row.isActive || row.status === 'disabled') return 'disabled';
  if (row.availability?.status === 'available') return 'ready';
  return row.availability?.reasons?.[0] ?? 'not_ready';
}

function invalidateAdvisorQueries(
  queryClient: ReturnType<typeof useQueryClient>
) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'advisors'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'model-config'] });
  queryClient.invalidateQueries({
    queryKey: ['admin', 'advisor-prompt-sources']
  });
  queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-health'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'prompt-cache'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
  queryClient.invalidateQueries({ queryKey: ['advisors'] });
}

export function CreateAdvisorButton() {
  const [open, setOpen] = useState(false);
  const { data: catalogData } = useQuery(modelCatalogQuery);
  const catalog =
    (catalogData as ModelCatalogResponse | undefined)?.data?.providers ?? [];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Add Advisor
      </Button>
      {open && (
        <AdvisorDialog
          mode="create"
          catalog={catalog}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AdvisorDialog({
  mode,
  row,
  catalog,
  onClose
}: {
  mode: 'create' | 'edit';
  row?: AdminAdvisor;
  catalog: ModelCatalogResponse['data']['providers'];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isCreate = mode === 'create';
  const firstProvider = catalog[0];
  const currentProvider = row?.modelConfig?.provider;
  const providerAvailable = catalog.some((p) => p.provider === currentProvider);

  const [id, setId] = useState(row?.id ?? '');
  const [name, setName] = useState(row?.name ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [promptDocId, setPromptDocId] = useState(row?.promptDocId ?? '');
  const [isActive, setIsActive] = useState(row?.isActive ?? true);
  const [status, setStatus] = useState(row?.status ?? 'active');
  const [provider, setProvider] = useState(
    isCreate ? (firstProvider?.provider ?? '') : (currentProvider ?? '')
  );
  const [model, setModel] = useState(
    isCreate
      ? (firstProvider?.models[0]?.model ?? '')
      : (row?.modelConfig?.model ?? '')
  );
  const [modelEnabled, setModelEnabled] = useState(
    row?.modelConfig?.isEnabled ?? true
  );

  const providerEntry = catalog.find((p) => p.provider === provider);
  const models =
    providerEntry?.models.map((m) => m.model) ?? [model].filter(Boolean);
  const modelAvailable = Boolean(
    providerEntry?.models.some((m) => m.model === model)
  );
  const isStale =
    !isCreate && currentProvider && (!providerAvailable || !modelAvailable);

  const mutation = useMutation({
    mutationFn: () => {
      const input: CreateAdvisorInput | UpdateAdvisorInput = {
        name: name.trim(),
        description: description.trim(),
        promptDocId: promptDocId.trim() || null,
        isActive,
        status,
        modelConfig: {
          provider,
          model,
          isEnabled: modelEnabled
        }
      };

      if (isCreate) {
        return createAdvisor({ id: id.trim(), ...input } as CreateAdvisorInput);
      }

      return updateAdvisor(row!.id, input);
    },
    onSuccess: () => {
      invalidateAdvisorQueries(queryClient);
      toast.success(isCreate ? 'Advisor created' : 'Advisor updated');
      onClose();
    },
    onError: () => {
      toast.error(
        isCreate ? 'Failed to create advisor' : 'Failed to update advisor'
      );
    }
  });

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const entry = catalog.find((p) => p.provider === nextProvider);
    setModel(entry?.models[0]?.model ?? '');
  }

  function handleActiveChange(nextActive: boolean) {
    setIsActive(nextActive);
    setStatus(nextActive ? 'active' : 'disabled');
    if (!nextActive) setModelEnabled(false);
  }

  const canSave =
    name.trim().length > 0 &&
    model.trim().length > 0 &&
    provider.trim().length > 0 &&
    !isStale &&
    (!isCreate || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id.trim()));

  return (
    <Dialog open={true} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Add Advisor' : 'Edit Advisor'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {isCreate ? (
            <div className="space-y-1.5">
              <Label htmlFor="advisor-id">Advisor ID</Label>
              <Input
                id="advisor-id"
                value={id}
                onChange={(event) => setId(event.target.value)}
                placeholder="data-mentor"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="advisor-name">Name</Label>
            <Input
              id="advisor-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Data Mentor Advisor"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="advisor-description">Description</Label>
            <Textarea
              id="advisor-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="advisor-prompt-doc">Prompt Google Doc ID</Label>
            <Input
              id="advisor-prompt-doc"
              value={promptDocId}
              onChange={(event) => setPromptDocId(event.target.value)}
              placeholder="1a2b3c4d5e..."
            />
          </div>

          {isStale && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              The current model ({currentProvider}/{row?.modelConfig?.model}) is
              no longer available. Select a new provider and model to save.
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="advisor-provider">Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="advisor-provider" className="w-full">
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
            <Label htmlFor="advisor-model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="advisor-model" className="w-full">
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
            <Label htmlFor="advisor-active">Active</Label>
            <Switch
              id="advisor-active"
              checked={isActive}
              onCheckedChange={handleActiveChange}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2">
            <Label htmlFor="advisor-model-enabled">Model enabled</Label>
            <Switch
              id="advisor-model-enabled"
              checked={modelEnabled}
              onCheckedChange={setModelEnabled}
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdvisorActions({
  row,
  catalog
}: {
  row: AdminAdvisor;
  catalog: ModelCatalogResponse['data']['providers'];
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: () => publishAdvisor(row.id),
    onSuccess: () => {
      invalidateAdvisorQueries(queryClient);
      toast.success('Advisor published');
    },
    onError: () => {
      toast.error('Failed to publish advisor');
    }
  });

  const disableMutation = useMutation({
    mutationFn: () => deleteAdvisor(row.id),
    onSuccess: () => {
      invalidateAdvisorQueries(queryClient);
      toast.success('Advisor disabled');
    },
    onError: () => {
      toast.error('Failed to disable advisor');
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: () =>
      updateAdvisor(row.id, {
        isActive: true,
        status: 'active',
        modelConfig: row.modelConfig
          ? {
              provider: row.modelConfig.provider,
              model: row.modelConfig.model,
              isEnabled: true
            }
          : undefined
      }),
    onSuccess: () => {
      invalidateAdvisorQueries(queryClient);
      toast.success('Advisor reactivated');
    },
    onError: () => {
      toast.error('Failed to reactivate advisor');
    }
  });

  const canPublish =
    row.isActive &&
    row.status === 'active' &&
    Boolean(row.promptDocId) &&
    Boolean(row.modelConfig?.isEnabled);
  const isBusy =
    publishMutation.isPending ||
    disableMutation.isPending ||
    reactivateMutation.isPending;

  return (
    <div className="flex justify-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Publish advisor"
              disabled={!canPublish || isBusy}
              onClick={() => publishMutation.mutate()}
            >
              <PlayIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Publish</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit advisor"
              disabled={isBusy}
              onClick={() => setEditing(true)}
            >
              <PencilIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {row.isActive && row.status !== 'disabled' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Disable advisor"
                disabled={isBusy}
                onClick={() => disableMutation.mutate()}
              >
                <CirclePauseIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disable</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reactivate advisor"
                disabled={isBusy}
                onClick={() => reactivateMutation.mutate()}
              >
                <CheckCircle2Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reactivate</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {editing && (
        <AdvisorDialog
          mode="edit"
          row={row}
          catalog={catalog}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export function AdvisorManagementPanel() {
  const { data, isLoading, error, refetch } = useQuery(
    adminAdvisorsQuery({ limit: 100 })
  );
  const { data: catalogData } = useQuery(modelCatalogQuery);
  const catalog =
    (catalogData as ModelCatalogResponse | undefined)?.data?.providers ?? [];
  const rows = useMemo(() => data?.data ?? [], [data]);

  if (error) {
    return (
      <Card>
        <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-destructive text-sm">Failed to load advisors.</p>
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
        <AdminDataTable
          columns={
            [
              {
                accessorKey: 'name',
                header: 'Advisor',
                cell: ({ row }) => (
                  <div>
                    <p className="font-medium">{row.original.name}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {row.original.id}
                    </p>
                  </div>
                )
              },
              {
                id: 'readiness',
                header: 'Readiness',
                cell: ({ row }) => (
                  <Badge variant={statusVariant(row.original)}>
                    {readinessLabel(row.original)}
                  </Badge>
                )
              },
              {
                id: 'model',
                header: 'Model',
                cell: ({ row }) => (
                  <div className="text-xs">
                    <p className="font-medium">
                      {row.original.modelConfig?.provider ?? 'not set'}
                    </p>
                    <p className="text-muted-foreground font-mono">
                      {row.original.modelConfig?.model ?? 'No model'}
                    </p>
                  </div>
                )
              },
              {
                accessorKey: 'promptDocId',
                header: 'Prompt Doc',
                cell: ({ row }) => (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help font-mono text-xs">
                          {shortValue(row.original.promptDocId)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.original.promptDocId ??
                          'No prompt Doc ID configured'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              },
              {
                accessorKey: 'activeRuntimeVersionId',
                header: 'Runtime',
                cell: ({ row }) =>
                  row.original.activeRuntimeVersionId ? (
                    <CheckCircle2Icon className="size-4 text-[#2d6a4f]" />
                  ) : (
                    <XCircleIcon className="text-muted-foreground size-4" />
                  )
              },
              {
                accessorKey: 'updatedAt',
                header: 'Updated',
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
                  <AdvisorActions row={row.original} catalog={catalog} />
                )
              }
            ] as ColumnDef<AdminAdvisor>[]
          }
          data={rows}
          isLoading={isLoading}
          emptyMessage="No advisors configured."
          enableSorting={true}
          enablePagination={false}
        />
      </CardContent>
    </Card>
  );
}
