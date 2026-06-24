'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast
} from '@eskwelabs-advisor/ui';

import {
  knowledgeSourcesQuery,
  knowledgeHealthQuery
} from '@/lib/domains/admin/queries';
import {
  createKnowledgeSource,
  refreshKnowledgeSource,
  refreshAllKnowledgeSources
} from '@/lib/domains/admin/api';

interface SourceRow {
  id: string;
  title: string;
  sourceType: string;
  externalId: string;
  status: string;
  contentType: string;
  advisorScope: string;
  revision: string | null;
  lastIngestedAt: string | null;
  createdAt: string;
}

interface HealthData {
  sourceCount: number;
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function SourceTable() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('policy');
  const [advisorScope, setAdvisorScope] = useState('global');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery(knowledgeSourcesQuery());

  const createMutation = useMutation({
    mutationFn: () =>
      createKnowledgeSource({
        sourceType: 'google_doc',
        externalId,
        title,
        advisorScope,
        contentType,
        audience: 'advisor'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-health']
      });
      toast.success('Knowledge source created');
      setCreateOpen(false);
      setExternalId('');
      setTitle('');
    },
    onError: () => {
      toast.error('Failed to create knowledge source');
    }
  });

  const refreshSingleMutation = useMutation({
    mutationFn: (sourceId: string) => refreshKnowledgeSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-health']
      });
      toast.success('Source refreshed');
      setRefreshingId(null);
    },
    onError: () => {
      toast.error('Failed to refresh source');
      setRefreshingId(null);
    }
  });

  const refreshAllMutation = useMutation({
    mutationFn: refreshAllKnowledgeSources,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-sources']
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'knowledge-health']
      });
      toast.success('All sources refreshed');
    },
    onError: () => {
      toast.error('Failed to refresh sources');
    }
  });

  const canCreate = externalId.trim().length > 0 && title.trim().length > 0;

  if (isLoading) {
    return (
      <div className="space-y-3 px-8 py-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive px-8 py-8 text-sm">
        Failed to load knowledge sources.
      </p>
    );
  }

  const sources = (data as { data: SourceRow[] } | undefined)?.data ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon className="size-4" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Register Knowledge Source</DialogTitle>
              <DialogDescription>
                Add a Google Doc as a knowledge source for factual grounding.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enrollment Policies"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Doc ID</label>
                <Input
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="1a2b3c4d5e..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content Type</label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="policy">Policy</SelectItem>
                      <SelectItem value="faq">FAQ</SelectItem>
                      <SelectItem value="course_material">
                        Course Material
                      </SelectItem>
                      <SelectItem value="mentor_guide">Mentor Guide</SelectItem>
                      <SelectItem value="rubric">Rubric</SelectItem>
                      <SelectItem value="ops_rule">Ops Rule</SelectItem>
                      <SelectItem value="advisor_reference">
                        Reference
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Advisor Scope</label>
                  <Select value={advisorScope} onValueChange={setAdvisorScope}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="data-modeling">
                        Data Modeling
                      </SelectItem>
                      <SelectItem value="data-dashboard">
                        Data Dashboard
                      </SelectItem>
                      <SelectItem value="sql-analytics">
                        SQL Analytics
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canCreate || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshAllMutation.mutate()}
          disabled={refreshAllMutation.isPending}
        >
          <RefreshCwIcon
            className={`size-4 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`}
          />
          Refresh All
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">
            No knowledge sources registered.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Last Ingested</TableHead>
                <TableHead className="pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="py-4 pl-6 font-medium">
                    {source.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs uppercase tracking-widest">
                    {source.contentType}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {source.advisorScope}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium ${
                        source.status === 'published'
                          ? 'text-green-600'
                          : source.status === 'failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {source.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {source.revision ?? '\u2014'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(source.lastIngestedAt)}
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRefreshingId(source.id);
                        refreshSingleMutation.mutate(source.id);
                      }}
                      disabled={refreshingId === source.id}
                    >
                      <RefreshCwIcon
                        className={`size-3 ${refreshingId === source.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function HealthPanel() {
  const { data, isLoading, error } = useQuery(knowledgeHealthQuery);
  const health = data as { data: HealthData } | undefined;

  if (isLoading) {
    return (
      <div className="space-y-3 px-8 py-8">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive px-8 py-8 text-sm">
        Failed to load knowledge health.
      </p>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">
              Sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {health?.data?.sourceCount ?? '\u2014'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">
              Retrieval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Lexical (Postgres)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function KnowledgePanel() {
  return (
    <Card className="relative flex flex-1 flex-col">
      <CardContent className="flex flex-1 flex-col p-0">
        <Tabs defaultValue="sources" className="flex flex-1 flex-col">
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>
          <TabsContent value="sources" className="flex-1">
            <SourceTable />
          </TabsContent>
          <TabsContent value="health" className="flex-1">
            <HealthPanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
