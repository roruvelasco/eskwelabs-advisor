import type { ReactNode } from 'react';

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="min-h-screen bg-white text-zinc-950">{children}</div>;
}
