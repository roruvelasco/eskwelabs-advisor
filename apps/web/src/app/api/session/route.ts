import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  const token = secret
    ? ((await getToken({
        req: request,
        secret,
        secureCookie: request.nextUrl.protocol === 'https:'
      })) as Record<string, unknown> | null)
    : null;

  if (!token) {
    return NextResponse.json({ data: null });
  }

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

  if (!id || !email || !role || !isActive) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: { id, email, role, isActive }
  });
}
