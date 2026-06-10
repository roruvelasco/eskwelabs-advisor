import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SessionActor } from './session';

async function getServerSessionActor(): Promise<SessionActor | null> {
  const h = await headers();
  const id = h.get('x-eskwelabs-actor-id');
  const email = h.get('x-eskwelabs-actor-email');
  const role = h.get('x-eskwelabs-actor-role');
  const active = h.get('x-eskwelabs-actor-active');

  if (!id || !email) return null;

  return {
    id,
    email,
    role: role === 'admin' ? 'admin' : 'eif',
    isActive: active !== 'false'
  };
}

// Safe to call from admin/layout.tsx which also wraps /admin/login.
// Unauthenticated requests to /admin/login have no actor header, so the
// guard is a no-op for them — middleware already decided to allow them.
export async function requireAdminIfAuthenticated(): Promise<void> {
  const actor = await getServerSessionActor();
  if (!actor) return;
  if (actor.role !== 'admin') redirect('/login');
}
