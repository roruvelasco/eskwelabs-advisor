'use client';

import type { ComponentType } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3Icon,
  ChevronRight,
  DatabaseIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LogOut,
  MenuIcon,
  RadioTowerIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  XIcon
} from 'lucide-react';

import { useRouter } from 'next/navigation';

import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  Skeleton
} from '@eskwelabs-advisor/ui';

import { cn } from '@/lib/utils';
import {
  adminUsageQuery,
  usageLimitsQuery,
  knowledgeHealthQuery
} from '@/lib/domains/admin/queries';
import { sessionQuery } from '@/lib/domains/auth/queries';
import { CachePanel } from './cache-panel';
import { KnowledgePanel } from './knowledge-panel';
import { LimitsPanel } from './limits-panel';
import { ModelConfigPanel } from './model-config-panel';
import { TelemetryPanel } from './telemetry-panel';
import { UsagePanel } from './usage-panel';
import { UsersPanel } from './users-panel';

type AdminSection =
  | 'usage'
  | 'model-config'
  | 'cache'
  | 'limits'
  | 'telemetry'
  | 'users'
  | 'knowledge';

interface AdminOverview {
  counts: {
    usageRows: number;
    modelConfigs: number;
    promptCacheEntries: number;
    telemetryEvents: number;
    users: number;
  };
}

interface UsageLimitsData {
  config: {
    maxMessagesPerUserPerDay: number;
    maxTokensPerUserPerDay: number;
    dailyBudgetUsd: string;
    monthlyBudgetUsd: string;
    rateLimitWindowSeconds: number;
    rateLimitMaxRequests: number;
  };
}

interface KnowledgeHealthData {
  sources: { total: number; active: number };
  units: { total: number; embedded: number };
}

const sections: Array<{
  id: AdminSection;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: 'usage', label: 'Usage', icon: BarChart3Icon },
  { id: 'model-config', label: 'Models', icon: DatabaseIcon },
  { id: 'cache', label: 'Cache', icon: RadioTowerIcon },
  { id: 'knowledge', label: 'Knowledge', icon: LibraryIcon },
  { id: 'limits', label: 'Limits', icon: SettingsIcon },
  { id: 'telemetry', label: 'Events', icon: LayoutDashboardIcon },
  { id: 'users', label: 'Users', icon: UsersIcon }
];

function KpiCard({
  label,
  value,
  isLoading
}: {
  label: string;
  value: number | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="border-[#e2e0db] bg-white">
      <CardContent className="px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[#8a8578] sm:text-xs">
          {label}
        </p>
        {isLoading || value === undefined ? (
          <Skeleton className="mt-2 h-7 w-14 sm:h-8 sm:w-16" />
        ) : (
          <p className="mt-1 font-serif text-xl font-semibold text-[#2d6a4f] sm:text-2xl">
            {value.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function useKpiCards(section: AdminSection) {
  const { data: overviewData, isLoading: overviewLoading } =
    useQuery(adminUsageQuery);
  const overview = (overviewData as { data: AdminOverview } | undefined)?.data;

  const { data: limitsData, isLoading: limitsLoading } = useQuery({
    ...usageLimitsQuery,
    enabled: section === 'limits'
  });
  const limits = (limitsData as { data: UsageLimitsData } | undefined)?.data;

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    ...knowledgeHealthQuery,
    enabled: section === 'knowledge'
  });
  const knowledge = (knowledgeData as { data: KnowledgeHealthData } | undefined)
    ?.data;

  const cardsBySection: Record<
    AdminSection,
    {
      cards: { label: string; value: number | undefined }[];
      isLoading: boolean;
    }
  > = {
    usage: {
      isLoading: overviewLoading,
      cards: [
        { label: 'Users', value: overview?.counts.users },
        { label: 'Usage Rows', value: overview?.counts.usageRows },
        { label: 'Models', value: overview?.counts.modelConfigs },
        { label: 'Events', value: overview?.counts.telemetryEvents }
      ]
    },
    'model-config': {
      isLoading: overviewLoading,
      cards: [
        { label: 'Model Configs', value: overview?.counts.modelConfigs },
        { label: 'Users', value: overview?.counts.users },
        { label: 'Usage Rows', value: overview?.counts.usageRows },
        { label: 'Events', value: overview?.counts.telemetryEvents }
      ]
    },
    cache: {
      isLoading: overviewLoading,
      cards: [
        {
          label: 'Cache Entries',
          value: overview?.counts.promptCacheEntries
        },
        { label: 'Models', value: overview?.counts.modelConfigs },
        { label: 'Users', value: overview?.counts.users },
        { label: 'Events', value: overview?.counts.telemetryEvents }
      ]
    },
    knowledge: {
      isLoading: knowledgeLoading,
      cards: [
        { label: 'Sources', value: knowledge?.sources?.total },
        { label: 'Active Sources', value: knowledge?.sources?.active },
        { label: 'Units', value: knowledge?.units?.total },
        { label: 'Embedded', value: knowledge?.units?.embedded }
      ]
    },
    limits: {
      isLoading: limitsLoading,
      cards: [
        {
          label: 'Msg / Day',
          value: limits?.config?.maxMessagesPerUserPerDay
        },
        {
          label: 'Tokens / Day',
          value: limits?.config?.maxTokensPerUserPerDay
        },
        {
          label: 'Rate Limit',
          value: limits?.config?.rateLimitMaxRequests
        },
        {
          label: 'Window (s)',
          value: limits?.config?.rateLimitWindowSeconds
        }
      ]
    },
    telemetry: {
      isLoading: overviewLoading,
      cards: [
        { label: 'Total Events', value: overview?.counts.telemetryEvents },
        { label: 'Users', value: overview?.counts.users },
        { label: 'Usage Rows', value: overview?.counts.usageRows },
        { label: 'Models', value: overview?.counts.modelConfigs }
      ]
    },
    users: {
      isLoading: overviewLoading,
      cards: [
        { label: 'Total Users', value: overview?.counts.users },
        { label: 'Models', value: overview?.counts.modelConfigs },
        { label: 'Usage Rows', value: overview?.counts.usageRows },
        { label: 'Events', value: overview?.counts.telemetryEvents }
      ]
    }
  };

  return cardsBySection[section];
}

function OverviewCards({ section }: { section: AdminSection }) {
  const { cards, isLoading } = useKpiCards(section);

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={`${section}-${card.label}`}
          label={card.label}
          value={card.value}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}

function AdminPanel({ section }: { section: AdminSection }) {
  if (section === 'model-config') return <ModelConfigPanel />;
  if (section === 'cache') return <CachePanel />;
  if (section === 'knowledge') return <KnowledgePanel />;
  if (section === 'limits') return <LimitsPanel />;
  if (section === 'telemetry') return <TelemetryPanel />;
  if (section === 'users') return <UsersPanel />;
  return <UsagePanel />;
}

function SidebarContent({
  section,
  sidebarCollapsed,
  adminName,
  adminInitials,
  onSelect,
  onLogout,
  onToggleCollapse
}: {
  section: AdminSection;
  sidebarCollapsed: boolean;
  adminName: string;
  adminInitials: string;
  onSelect: (id: AdminSection) => void;
  onLogout: () => void;
  onToggleCollapse: () => void;
}) {
  return (
    <>
      {/* Profile area */}
      <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-6">
        <Avatar
          className={cn(
            'border-2 border-white/30 transition-all',
            sidebarCollapsed ? 'size-10' : 'size-14'
          )}
        >
          <AvatarFallback className="bg-white/20 font-medium text-white">
            {adminInitials}
          </AvatarFallback>
        </Avatar>
        {!sidebarCollapsed && (
          <p className="text-sm font-medium tracking-wide text-[#f9f9f8]">
            {adminName}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {sections.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight
                        className={cn(
                          'size-3.5 shrink-0 transition-transform',
                          isActive && 'rotate-90'
                        )}
                      />
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar footer */}
      <div className="px-3 pb-4">
        {!sidebarCollapsed && (
          <div className="mb-3 rounded-lg border border-white/20 px-3 py-2">
            <div className="flex items-center gap-2 text-white/50">
              <SearchIcon className="size-3.5" />
              <span className="text-xs">Search...</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4 shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-1 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white md:flex"
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 transition-transform',
              sidebarCollapsed ? '' : 'rotate-180'
            )}
          />
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>('usage');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useQuery(sessionQuery);

  const handleLogout = async () => {
    await fetch('/api/signout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  };

  const adminName = session?.email?.split('@')[0] ?? 'Admin';
  const adminInitials = adminName.slice(0, 2).toUpperCase();

  const handleSelect = (id: AdminSection) => {
    setSection(id);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-dvh bg-[#faf9f7]">
      {/* ── Mobile header ─────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#2d6a4f] px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10"
        >
          <MenuIcon className="size-5" />
        </button>
        <h1 className="font-serif text-base font-semibold text-[#f9f9f8]">
          {sections.find((s) => s.id === section)?.label ?? 'Admin'}
        </h1>
        <div className="w-9" />
      </header>

      {/* ── Mobile sidebar overlay ────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
            role="button"
            tabIndex={0}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[#2d6a4f]">
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <SidebarContent
              section={section}
              sidebarCollapsed={false}
              adminName={adminName}
              adminInitials={adminInitials}
              onSelect={handleSelect}
              onLogout={() => void handleLogout()}
              onToggleCollapse={() => {}}
            />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col bg-[#2d6a4f] transition-all duration-300 md:flex',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarContent
          section={section}
          sidebarCollapsed={sidebarCollapsed}
          adminName={adminName}
          adminInitials={adminInitials}
          onSelect={handleSelect}
          onLogout={() => void handleLogout()}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col pt-14 md:pt-0">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-4 sm:mb-6">
            <h2 className="font-serif text-lg font-bold text-[#222019] sm:text-xl">
              Dashboard Overview
            </h2>
            <p className="mt-1 text-xs text-[#8a8578] sm:text-sm">
              Monitor platform usage, models, and system health.
            </p>
          </div>

          <OverviewCards section={section} />

          <div className="mt-4 sm:mt-6">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h3 className="font-serif text-base font-semibold text-[#2d6a4f] sm:text-lg">
                {sections.find((s) => s.id === section)?.label}
              </h3>
            </div>

            <Card className="border-[#e2e0db] bg-white">
              <CardContent className="p-0">
                <AdminPanel section={section} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
