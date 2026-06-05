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
    <div className="flex flex-wrap justify-center gap-2">
      {MODES.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant="outline"
          className="motion-press text-muted-foreground hover:text-foreground gap-1.5 rounded-full text-sm"
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </Button>
      ))}
    </div>
  );
}
