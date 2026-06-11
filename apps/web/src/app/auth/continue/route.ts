import { NextRequest, NextResponse } from 'next/server';
import { resolvePostLoginDestination } from '@/lib/auth/redirect-policy';

export async function GET(request: NextRequest) {
  const id = request.headers.get('x-eskwelabs-actor-id');
  const email = request.headers.get('x-eskwelabs-actor-email');
  const role = request.headers.get('x-eskwelabs-actor-role');
  const active = request.headers.get('x-eskwelabs-actor-active');

  if (!id || !email || !role || active !== 'true') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (role !== 'admin' && role !== 'eif') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const destination = resolvePostLoginDestination(
    request.nextUrl.searchParams.get('returnTo'),
    role
  );

  return NextResponse.redirect(new URL(destination, request.url));
}
