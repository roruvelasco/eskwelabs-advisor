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
  const token = await getToken({
    req: request,
    secret: authSecret()
  });

  if (!token) return null;

  const id = typeof token.id === 'string' ? token.id : null;
  const email = typeof token.email === 'string' ? token.email : null;
  const role = token.role;
  const isActive = token.isActive === true;

  if (!id || !email || !isActive) return null;
  if (role !== 'eif' && role !== 'admin') return null;

  return {
    id,
    email,
    role,
    isActive
  };
}
