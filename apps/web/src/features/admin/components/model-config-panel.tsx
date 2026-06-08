'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Badge,
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
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
  'advisor-3': 'Advisor 3',
  'dna-digest': 'DNA Digest Summarizer'
};

const PROVIDERS: Record<string, { label: string; models: string[] }> = {
  google: {
    label: 'Google',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
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
  const queryClient = useQueryClient();
  const models = PROVIDERS[provider]?.models ?? [model].filter(Boolean);

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateModelConfig(row.advisorId, { provider, model }),
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
        <Button variant="outline" size="sm">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Advisor Models</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 px-6 py-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-sm">
            No model configuration rows found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.advisorId}>
                    <TableCell className="font-medium">
                      {ADVISOR_LABELS[row.advisorId] ?? row.advisorId}
                    </TableCell>
                    <TableCell className="capitalize">{row.provider}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.model}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.isEnabled ? 'default' : 'outline'}
                        className={
                          row.isEnabled
                            ? 'bg-success text-success-foreground'
                            : ''
                        }
                      >
                        {row.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
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
