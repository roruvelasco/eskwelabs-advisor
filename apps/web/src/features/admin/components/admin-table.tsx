'use client';

import type { ReactNode } from 'react';
import { ChevronsUpDown } from 'lucide-react';

import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead
} from '@eskwelabs-advisor/ui';

export function AdminTableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      {children}
    </div>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return <div className="min-h-[320px] overflow-x-auto">{children}</div>;
}

export function AdminTable({ children }: { children: ReactNode }) {
  return <Table>{children}</Table>;
}

export function AdminTableHead({
  children,
  className
}: {
  children: ReactNode;
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

export function AdminLoadingRows({
  rows = 4,
  columns = 6
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={columnIndex} className="py-4">
              <Skeleton className="h-5 w-full max-w-32" />
            </TableCell>
          ))}
        </tr>
      ))}
    </TableBody>
  );
}

export function AdminEmptyState({
  message,
  actionLabel,
  onAction
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
