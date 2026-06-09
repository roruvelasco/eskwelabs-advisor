import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const runtime = 'nodejs';

const eifRoutes = ['/advisors', '/chat', '/history', '/consent'];
const adminRoutes = ['/admin'];

function cspHeader(nonce: string) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''
  ]
    .filter(Boolean)
    .join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    "connect-src 'self'",
    'upgrade-insecure-requests'
  ].join('; ');
}

function withSecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set('Content-Security-Policy', cspHeader(nonce));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  return response;
}

function isPrefixed(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function deny(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '');

  if (request.nextUrl.pathname.startsWith('/api')) {
    return withSecurityHeaders(
      NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 }),
      nonce
    );
  }

  return withSecurityHeaders(
    NextResponse.redirect(new URL('/login', request.url)),
    nonce
  );
}

async function updateMiddleware(
  request: NextRequest,
  token: Record<string, unknown> | null
) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const pathname = request.nextUrl.pathname;

  const createResponse = (response: NextResponse) => {
    return withSecurityHeaders(response, nonce);
  };

  if (token?.email) {
    const email = (token.email as string).toLowerCase();
    const role = token.role as string | undefined;
    const isActive = token.isActive === true;
    const id = (token.id as string) || '';

    const isAdmin = role === 'admin';

    if (!id || !role || !isActive) {
      return createResponse(deny(request));
    }

    const actor = { id, email, role, isActive };

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-eskwelabs-actor-id', actor.id);
    requestHeaders.set('x-eskwelabs-actor-email', actor.email);
    requestHeaders.set('x-eskwelabs-actor-role', actor.role);
    requestHeaders.set('x-eskwelabs-actor-active', String(actor.isActive));
    requestHeaders.set('x-nonce', nonce);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });

    response.cookies.set('eskwelabs_actor_id', actor.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60
    });

    response.cookies.set('eskwelabs_actor_email', actor.email, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60
    });

    response.cookies.set('eskwelabs_actor_role', actor.role, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60
    });

    response.cookies.set('eskwelabs_actor_active', String(actor.isActive), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60
    });

    const isAdminArea =
      isPrefixed(pathname, adminRoutes) || pathname.startsWith('/api/admin');
    const isEifArea =
      isPrefixed(pathname, eifRoutes) ||
      pathname.startsWith('/api/advisors') ||
      pathname.startsWith('/api/conversations') ||
      pathname.startsWith('/api/messages') ||
      pathname.startsWith('/api/chat-turn') ||
      pathname.startsWith('/api/consent');

    if (isAdminArea && !isAdmin) {
      return createResponse(deny(request));
    }

    if (isEifArea && !isAdmin && role !== 'eif') {
      return createResponse(deny(request));
    }

    response.headers.set('Content-Security-Policy', cspHeader(nonce));
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'same-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    return response;
  }

  if (pathname === '/admin/login') {
    return createResponse(NextResponse.next());
  }

  const isProtected = [
    ...eifRoutes,
    ...adminRoutes,
    '/',
    '/api/advisors',
    '/api/conversations',
    '/api/messages',
    '/api/chat-turn',
    '/api/consent',
    '/api/admin'
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (isProtected) {
    return createResponse(deny(request));
  }

  const response = NextResponse.next();
  response.headers.set('x-nonce', nonce);
  response.headers.set('Content-Security-Policy', cspHeader(nonce));
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET
  });

  return updateMiddleware(request, token as Record<string, unknown> | null);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
