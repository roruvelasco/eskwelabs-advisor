'use client';

import { Code2, Coffee, GraduationCap, Pencil } from 'lucide-react';
import { Button } from '@eskwelabs-advisor/ui';

const MODES = [
  { label: 'Code', icon: Code2 },
  { label: 'Write', icon: Pencil },
  { label: 'Learn', icon: GraduationCap },
  { label: 'Life stuff', icon: Coffee }
] as const;

export function ChatModeChips() {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {MODES.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="motion-press border-border/50 text-muted-foreground hover:text-foreground hover:border-primary h-7 gap-1.5 rounded-full px-3 text-xs font-normal transition-colors duration-300 ease-in-out"
        >
          <Icon size={12} aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
}
