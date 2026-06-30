'use client';

import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';
import { cn } from '@/lib/utils';

interface AdminCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  /** If true, CardContent gets p-0 for AdminDataTable usage */
  tableMode?: boolean;
  className?: string;
}

export function AdminCard({
  title,
  description,
  children,
  tableMode,
  className
}: AdminCardProps) {
  return (
    <Card className={cn('flex flex-1 flex-col', className)}>
      {(title || description) && (
        <CardHeader>
          <div className="flex items-baseline gap-2">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(tableMode && 'flex flex-1 flex-col p-0')}
      >
        {children}
      </CardContent>
    </Card>
  );
}
