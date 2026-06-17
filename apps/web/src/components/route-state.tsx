'use client';

import { AlertTriangleIcon, ArrowLeftIcon, RotateCcwIcon } from 'lucide-react';

import {
  AppBrand,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  GrainOverlay,
  Skeleton
} from '@eskwelabs-advisor/ui';

type RouteStateVariant = 'error' | 'not-found';

interface RouteAction {
  href?: string;
  label: string;
  onClick?: () => void;
}

export interface RouteStateCopy {
  description: string;
  eyebrow: string;
  primaryAction: RouteAction;
  secondaryAction?: RouteAction;
  title: string;
  variant: RouteStateVariant;
}

export const routeStateCopy = {
  appError: {
    description:
      'The advisor workspace hit a problem. Try again, or return to advisor selection if the issue continues.',
    eyebrow: 'Workspace interrupted',
    primaryAction: { label: 'Try again' },
    secondaryAction: { href: '/advisors', label: 'Advisor selection' },
    title: 'We could not keep this page running.',
    variant: 'error'
  },
  authError: {
    description:
      'The sign-in page could not finish loading. Try again, or return to the login page.',
    eyebrow: 'Authentication interrupted',
    primaryAction: { label: 'Try again' },
    secondaryAction: { href: '/login', label: 'Login' },
    title: 'We could not load the authentication flow.',
    variant: 'error'
  },
  globalError: {
    description:
      'The application encountered an unrecoverable error. Reload the app to start a fresh session.',
    eyebrow: 'Application interrupted',
    primaryAction: { href: '/', label: 'Reload app' },
    title: 'Eskwelabs Advisor needs to reload.',
    variant: 'error'
  },
  rootError: {
    description:
      'The page stopped unexpectedly. Try again, or return to the advisor workspace.',
    eyebrow: 'Page interrupted',
    primaryAction: { label: 'Try again' },
    secondaryAction: { href: '/advisors', label: 'Advisor selection' },
    title: 'Something went wrong.',
    variant: 'error'
  },
  adminError: {
    description:
      'The admin console could not finish loading. Try again, or return to the console overview.',
    eyebrow: 'Admin console interrupted',
    primaryAction: { label: 'Try again' },
    secondaryAction: { href: '/admin', label: 'Admin overview' },
    title: 'We could not load the admin console.',
    variant: 'error'
  },
  notFound: {
    description:
      'The page may have moved, or the conversation link may no longer be valid.',
    eyebrow: 'Page not found',
    primaryAction: { href: '/advisors', label: 'Advisor selection' },
    secondaryAction: { href: '/history', label: 'Conversation history' },
    title: 'This page is not available.',
    variant: 'not-found'
  }
} satisfies Record<string, RouteStateCopy>;

export function RouteStateScreen({
  copy,
  reset
}: {
  copy: RouteStateCopy;
  reset?: () => void;
}) {
  const primaryAction =
    reset && !copy.primaryAction.href
      ? { ...copy.primaryAction, onClick: reset }
      : copy.primaryAction;

  return (
    <main className="bg-background text-foreground flex min-h-dvh items-center px-4 py-8">
      <GrainOverlay
        intensity="subtle"
        className="border-border bg-card mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <AppBrand />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            {copy.eyebrow}
          </span>
        </div>

        <Card className="border-0 bg-transparent shadow-none">
          <CardHeader className="gap-4 px-5 pt-10 sm:px-10">
            <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-md">
              <AlertTriangleIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-3">
              <CardTitle className="font-serif text-3xl leading-tight sm:text-4xl">
                {copy.title}
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7">
                {copy.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-5 pb-10 sm:flex-row sm:px-10">
            <RouteActionButton action={primaryAction} />
            {copy.secondaryAction ? (
              <RouteActionButton action={copy.secondaryAction} secondary />
            ) : null}
          </CardContent>
        </Card>
      </GrainOverlay>
    </main>
  );
}

function RouteActionButton({
  action,
  secondary
}: {
  action: RouteAction;
  secondary?: boolean;
}) {
  const icon = secondary ? (
    <ArrowLeftIcon className="size-4" aria-hidden="true" />
  ) : (
    <RotateCcwIcon className="size-4" aria-hidden="true" />
  );

  if (action.href) {
    return (
      <Button asChild variant={secondary ? 'outline' : 'default'}>
        <a href={action.href}>
          {icon}
          {action.label}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={secondary ? 'outline' : 'default'}
      onClick={action.onClick}
    >
      {icon}
      {action.label}
    </Button>
  );
}

export function RouteLoadingScreen({
  label = 'Loading workspace'
}: {
  label?: string;
}) {
  return (
    <main
      className="bg-background text-foreground flex min-h-dvh items-center px-4 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-center justify-between">
          <AppBrand />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            {label}
          </span>
        </div>
        <div className="border-border bg-card rounded-xl border p-5">
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="grid gap-3 pt-3 sm:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </main>
  );
}
