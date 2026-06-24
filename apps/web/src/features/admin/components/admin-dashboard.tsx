'use client';

import type { ComponentType } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3Icon,
  ChevronUp,
  DatabaseIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LogOut,
  RadioTowerIcon,
  UsersIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  AppBrand,
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GrainOverlay,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  Skeleton,
  useSidebar
} from '@eskwelabs-advisor/ui';

import { cn } from '@/lib/utils';
import { adminUsageQuery } from '@/lib/domains/admin/queries';
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
    modelConfigs: number;
    promptCacheEntries: number;
    telemetryEvents: number;
    users: number;
  };
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
  { id: 'limits', label: 'Limits', icon: BarChart3Icon },
  { id: 'telemetry', label: 'Events', icon: LayoutDashboardIcon },
  { id: 'users', label: 'Users', icon: UsersIcon }
];

function OverviewCards() {
  const { data, isLoading } = useQuery(adminUsageQuery);
  const overview = (data as { data: AdminOverview } | undefined)?.data;

  const cards = [
    { label: 'Users', value: overview?.counts.users },
    { label: 'Models', value: overview?.counts.modelConfigs },
    { label: 'Cache', value: overview?.counts.promptCacheEntries },
    { label: 'Events', value: overview?.counts.telemetryEvents }
  ];

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">
              {card.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || card.value === undefined ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {card.value.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
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

function AdminDashboardInner() {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>('usage');
  const { open, isMobile, openMobile } = useSidebar();
  const triggerHidden = isMobile ? openMobile : open;

  const handleLogout = async () => {
    await fetch('/api/signout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <>
      <Sidebar
        id="admin-sidebar"
        collapsible="offcanvas"
        className="!border-r-0"
      >
        <SidebarHeader className="px-5 py-5">
          <div className="flex items-center justify-between gap-2">
            <AppBrand />
            <SidebarTrigger aria-label="Close sidebar" className="size-9" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup className="px-3 py-4">
            <SidebarGroupLabel className="mb-1 text-xs uppercase tracking-widest">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sections.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={section === item.id}
                        onClick={() => setSection(item.id)}
                        tooltip={item.label}
                        className="py-2"
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-4 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="hover:bg-sidebar-accent h-auto w-full justify-between gap-2 px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback>AD</AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground min-w-0 truncate text-sm font-normal">
                    Admin console
                  </span>
                </span>
                <ChevronUp className="text-muted-foreground size-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void handleLogout()}
              >
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-background flex min-h-dvh flex-col p-3">
        <GrainOverlay
          intensity="subtle"
          className="bg-card border-border flex flex-1 flex-col rounded-xl border"
        >
          <header className="flex h-14 shrink-0 items-center px-4">
            <div
              className={cn(
                'transition-opacity duration-300 ease-in-out',
                triggerHidden
                  ? 'pointer-events-none invisible opacity-0'
                  : 'opacity-100'
              )}
            >
              <SidebarTrigger
                aria-controls="admin-sidebar"
                aria-label="Open sidebar"
                className="size-9"
              />
            </div>
          </header>

          <main className="flex w-full flex-1 flex-col gap-6 px-6 pb-8 lg:px-8 lg:pb-10">
            <OverviewCards />

            <div className="flex flex-1 flex-col">
              <AdminPanel section={section} />
            </div>
          </main>
        </GrainOverlay>
      </SidebarInset>
    </>
  );
}

export function AdminDashboard() {
  return (
    <SidebarProvider defaultOpen className="min-h-dvh">
      <AdminDashboardInner />
    </SidebarProvider>
  );
}
