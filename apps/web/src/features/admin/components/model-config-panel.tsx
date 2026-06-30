'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast
} from '@eskwelabs-advisor/ui';

import { updateModelConfig } from '@/lib/domains/admin/api';
import { modelConfigQuery } from '@/lib/domains/admin/queries';
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

const ADVISOR_LABELS: Record<string, string> = {
  'data-dashboard': 'Data Dashboard Advisor',
  'ssot-memo': 'SSOT Memo Advisor',
  'data-modeling': 'Data Modeling Advisor',
  'dna-digest': 'DNA Digest Summarizer'
};

const PROVIDERS: Record<string, { label: string; models: string[] }> = {
  google: {
    label: 'Google',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  },
  groq: {
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo']
  },
  anthropic: {
    label: 'Anthropic',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest']
  },
  deterministic: {
    label: 'Deterministic',
    models: ['deterministic-model']
  }
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function EditModelDialog({ row }: { row: ModelConfigRow }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(row.provider);
  const [model, setModel] = useState(row.model);
  const [isEnabled, setIsEnabled] = useState(row.isEnabled);
  const queryClient = useQueryClient();
  const models = PROVIDERS[provider]?.models ?? [model].filter(Boolean);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateModelConfig(row.advisorId, { provider, model, isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'model-config'] });
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
    setModel(PROVIDERS[nextProvider]?.models[0] ?? '');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ADVISOR_LABELS[row.advisorId] ?? row.advisorId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                {Object.entries(PROVIDERS).map(([key, providerOption]) => (
                  <SelectItem key={key} value={key}>
                    {providerOption.label}
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
          <Button onClick={() => mutate()} disabled={isPending || !model}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModelConfigPanel() {
  const { data, isLoading, error } = useQuery(modelConfigQuery);
  const rows = (data as { data: ModelConfigRow[] } | undefined)?.data ?? [];

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
    <Card className="flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col p-0">
        <AdminDataTable
          columns={
            [
              {
                accessorKey: 'advisorId',
                header: 'Advisor',
                cell: ({ row }) => (
                  <span className="font-medium">
                    {ADVISOR_LABELS[row.original.advisorId] ??
                      row.original.advisorId}
                  </span>
                )
              },
              {
                accessorKey: 'provider',
                header: 'Provider',
                cell: ({ row }) => (
                  <span className="capitalize">{row.original.provider}</span>
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
                    variant={row.original.isEnabled ? 'default' : 'destructive'}
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
                    <EditModelDialog row={row.original} />
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
      </CardContent>
    </Card>
  );
}
