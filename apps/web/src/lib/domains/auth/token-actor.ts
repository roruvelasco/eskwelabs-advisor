import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import type { SessionActor } from './session';

export function authSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET or AUTH_SECRET must be set');
  }
  return secret;
}

export async function getVerifiedTokenActor(
  request: NextRequest
): Promise<SessionActor | null> {
  const secret = authSecret();

  const cookieNames = request.cookies.getAll().map(({ name }) => name);

  const token = await getToken({
    req: request,
    secret,
    secureCookie: request.nextUrl.protocol === 'https:'
  });

  console.info('token_actor_probe', {
    path: request.nextUrl.pathname,

    cookieNames,
    hasNextAuthSessionCookie: cookieNames.some((name) =>
      name.includes('next-auth.session-token')
    ),

    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    secretsEqual:
      Boolean(process.env.NEXTAUTH_SECRET) &&
      Boolean(process.env.AUTH_SECRET) &&
      process.env.NEXTAUTH_SECRET === process.env.AUTH_SECRET,

    hasToken: Boolean(token),

    tokenShape: token
      ? {
          hasSub: typeof token.sub === 'string',
          hasId: typeof token.id === 'string',
          email: token.email ?? null,
          role: token.role ?? null,
          isActive: token.isActive ?? null
        }
      : null
  });

  if (!token) return null;

  const id =
    typeof token.id === 'string'
      ? token.id
      : typeof token.sub === 'string'
        ? token.sub
        : null;

  const email = typeof token.email === 'string' ? token.email : null;

  const role =
    token.role === 'admin' || token.role === 'eif' ? token.role : null;

  const isActive = token.isActive === true;

  if (!id || !email || !role || !isActive) return null;

  return {
    id,
    email,
    role,
    isActive
  };
}
