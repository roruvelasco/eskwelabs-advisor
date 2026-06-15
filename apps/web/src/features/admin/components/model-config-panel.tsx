'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';

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
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast
} from '@eskwelabs-advisor/ui';

import { updateModelConfig } from '@/lib/domains/admin/api';
import { modelConfigQuery } from '@/lib/domains/admin/queries';

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

function SortHead({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
        {children}
        <ChevronsUpDown className="text-muted-foreground/40 size-3 shrink-0" />
      </span>
    </TableHead>
  );
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
        {isLoading ? (
          <div className="space-y-3 px-8 py-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No model configuration rows found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead className="pl-6">Advisor</SortHead>
                  <SortHead>Provider</SortHead>
                  <SortHead>Model</SortHead>
                  <SortHead>Status</SortHead>
                  <SortHead>Last Updated</SortHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.advisorId}>
                    <TableCell className="py-4 pl-6 font-medium">
                      {ADVISOR_LABELS[row.advisorId] ?? row.advisorId}
                    </TableCell>
                    <TableCell className="py-4 capitalize">
                      {row.provider}
                    </TableCell>
                    <TableCell className="py-4 font-mono text-xs">
                      {row.model}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant={row.isEnabled ? 'default' : 'destructive'}
                      >
                        {row.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-4 text-xs">
                      {formatDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      <EditModelDialog row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
