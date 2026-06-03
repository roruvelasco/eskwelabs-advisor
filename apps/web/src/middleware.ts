import { NextResponse, type NextRequest } from 'next/server';

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
    "upgrade-insecure-requests"
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

function csv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function resolveActor(request: NextRequest) {
  const email = request.cookies.get('eskwelabs_actor_email')?.value.toLowerCase();
  const id = request.cookies.get('eskwelabs_actor_id')?.value;
  const role = request.cookies.get('eskwelabs_actor_role')?.value;
  const active = request.cookies.get('eskwelabs_actor_active')?.value;

  if (!email || !id) return null;

  const adminEmails = csv('ADMIN_EMAILS');
  return {
    id,
    email,
    role: adminEmails.includes(email) ? 'admin' : role === 'admin' ? 'admin' : 'eif',
    isActive: active !== 'false'
  };
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

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const pathname = request.nextUrl.pathname;
  const actor = resolveActor(request);
  const adminEmails = csv('ADMIN_EMAILS');
  const eifAllowlist = csv('EIF_ALLOWLIST_EMAILS');
  const isAdminArea =
    isPrefixed(pathname, adminRoutes) || pathname.startsWith('/api/admin');
  const isEifArea =
    isPrefixed(pathname, eifRoutes) ||
    pathname.startsWith('/api/advisors') ||
    pathname.startsWith('/api/conversations') ||
    pathname.startsWith('/api/messages') ||
      pathname.startsWith('/api/chat-turn') ||
      pathname.startsWith('/api/consent');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  if (!isAdminArea && !isEifArea) {
    return withSecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders
        }
      }),
      nonce
    );
  }

  if (!actor?.isActive) {
    return deny(request);
  }

  const isAdmin = actor.role === 'admin' && adminEmails.includes(actor.email);
  const isAllowlistedEif =
    actor.role === 'eif' && eifAllowlist.includes(actor.email);

  if (isAdminArea && !isAdmin) {
    return deny(request);
  }

  if (isEifArea && !isAdmin && !isAllowlistedEif) {
    return deny(request);
  }

  requestHeaders.set('x-eskwelabs-actor-id', actor.id);
  requestHeaders.set('x-eskwelabs-actor-email', actor.email);
  requestHeaders.set('x-eskwelabs-actor-role', actor.role);
  requestHeaders.set('x-eskwelabs-actor-active', String(actor.isActive));

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    nonce
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
