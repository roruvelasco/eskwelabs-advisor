'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  RadioTowerIcon,
  UsersIcon
} from 'lucide-react';

import {
  Badge,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@eskwelabs-advisor/ui';

import { adminUsageQuery } from '@/lib/domains/admin/queries';

import { CachePanel } from './cache-panel';
import { ModelConfigPanel } from './model-config-panel';
import { TelemetryPanel } from './telemetry-panel';
import { UsagePanel } from './usage-panel';
import { UsersPanel } from './users-panel';

interface AdminOverview {
  counts: {
    modelConfigs: number;
    promptCacheEntries: number;
    telemetryEvents: number;
    users: number;
  };
}

function OverviewBadges() {
  const { data, isLoading } = useQuery(adminUsageQuery);
  const overview = (data as { data: AdminOverview } | undefined)?.data;

  if (isLoading || !overview) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-5 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  const badges = [
    { label: 'Users', value: overview.counts.users },
    { label: 'Models', value: overview.counts.modelConfigs },
    { label: 'Cache', value: overview.counts.promptCacheEntries },
    { label: 'Events', value: overview.counts.telemetryEvents }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge key={badge.label} variant="secondary" className="gap-1 text-xs">
          <span className="text-muted-foreground">{badge.label}</span>
          <span className="font-semibold tabular-nums">{badge.value}</span>
        </Badge>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-foreground font-serif text-3xl font-semibold">
              Admin Dashboard
            </h1>
            <OverviewBadges />
          </div>
          <Separator />
        </header>

        <Tabs defaultValue="usage" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="usage" className="gap-1.5">
              <BarChart3Icon className="size-3.5" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="model-config" className="gap-1.5">
              <DatabaseIcon className="size-3.5" />
              Models
            </TabsTrigger>
            <TabsTrigger value="cache" className="gap-1.5">
              <RadioTowerIcon className="size-3.5" />
              Cache
            </TabsTrigger>
            <TabsTrigger value="telemetry" className="gap-1.5">
              <LayoutDashboardIcon className="size-3.5" />
              Events
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="size-3.5" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <UsagePanel />
          </TabsContent>
          <TabsContent value="model-config">
            <ModelConfigPanel />
          </TabsContent>
          <TabsContent value="cache">
            <CachePanel />
          </TabsContent>
          <TabsContent value="telemetry">
            <TelemetryPanel />
          </TabsContent>
          <TabsContent value="users">
            <UsersPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
