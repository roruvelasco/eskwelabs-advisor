import type { ReactNode } from 'react';
import { requireAdminIfAuthenticated } from '@/lib/domains/auth/session.server';

export default async function AdminLayout({
  children
}: {
  children: ReactNode;
}) {
  await requireAdminIfAuthenticated();
  return <>{children}</>;
}
