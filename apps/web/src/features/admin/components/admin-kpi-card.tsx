'use client';

import type { ReactNode } from 'react';

import { Card, CardContent, Skeleton } from '@eskwelabs-advisor/ui';

export function AdminKpiCard({
  label,
  value,
  description,
  isLoading
}: {
  label: string;
  value: ReactNode;
  description?: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border-[#e2e0db] bg-white">
      <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-[#8a8578] sm:text-xs">
          {label}
        </p>
        {isLoading ? (
          <Skeleton className="mt-2 h-7 w-14 sm:h-8 sm:w-16" />
        ) : (
          <>
            <p className="mt-1 font-serif text-xl font-semibold text-[#2d6a4f] sm:text-2xl">
              {value}
            </p>
            {description ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {description}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
