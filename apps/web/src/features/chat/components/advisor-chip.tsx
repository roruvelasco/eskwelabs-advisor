'use client';

import { cn } from '@/lib/utils';
import { getAdvisorMeta } from '@/lib/domains/advisors/meta';

interface AdvisorChipProps {
  id: string;
  name: string;
  className?: string;
}

export function AdvisorChip({ id, name, className }: AdvisorChipProps) {
  const { icon: Icon } = getAdvisorMeta(id);

  return (
    <div
      className={cn(
        'border-primary/20 bg-primary/5 text-primary inline-flex max-w-[min(70vw,22rem)] items-center gap-2 rounded-full border px-3 py-1.5',
        className
      )}
      title={name}
    >
      <Icon className="shrink-0" size={13} strokeWidth={1.75} />
      <span className="truncate text-xs font-medium">{name}</span>
    </div>
  );
}
