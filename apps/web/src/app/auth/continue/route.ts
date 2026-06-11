import { NextRequest, NextResponse } from 'next/server';
import { resolvePostLoginDestination } from '@/lib/auth/redirect-policy';
import { getVerifiedTokenActor } from '@/lib/domains/auth/token-actor';

export async function GET(request: NextRequest) {
  const actor = await getVerifiedTokenActor(request);

  console.info('continue_actor_probe', {
    actorResolved: Boolean(actor),
    role: actor?.role ?? null
  });

  if (!actor) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const destination = resolvePostLoginDestination(
    request.nextUrl.searchParams.get('returnTo'),
    actor.role
  );

  return NextResponse.redirect(new URL(destination, request.url));
}
