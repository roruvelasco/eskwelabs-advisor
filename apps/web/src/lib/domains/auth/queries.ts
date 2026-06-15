import { queryOptions } from '@tanstack/react-query';

import type { SessionActor } from './session';

async function fetchSession(): Promise<SessionActor | null> {
  const response = await fetch('/api/session');
  if (!response.ok) return null;
  const json = await response.json();
  return json.data ?? null;
}

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: fetchSession
});
