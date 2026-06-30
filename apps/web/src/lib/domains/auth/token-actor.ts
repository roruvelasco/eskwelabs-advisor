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

function shouldLogAuthDiagnostics() {
  return process.env.NODE_ENV !== 'production';
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

  if (shouldLogAuthDiagnostics()) {
    console.info('token_actor_probe', {
      path: request.nextUrl.pathname,
      cookieCount: cookieNames.length,
      hasNextAuthSessionCookie: cookieNames.some((name) =>
        name.includes('next-auth.session-token')
      ),
      hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      hasAuthSecret: Boolean(process.env.AUTH_SECRET),
      hasToken: Boolean(token),
      hasTokenId:
        typeof token?.id === 'string' || typeof token?.sub === 'string'
    });
  }

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
