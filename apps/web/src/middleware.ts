import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Route classification
// ---------------------------------------------------------------------------

type RouteKind = 'adminLogin' | 'eifLogin' | 'adminArea' | 'eifArea' | 'public';

const eifPagePrefixes = ['/advisors', '/chat', '/history', '/consent'];
const eifApiPrefixes = [
  '/api/advisors',
  '/api/conversations',
  '/api/messages',
  '/api/chat-turn',
  '/api/consent'
];

function isPrefixed(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function classifyRoute(pathname: string): RouteKind {
  if (pathname === '/admin/login') return 'adminLogin';
  if (pathname === '/login') return 'eifLogin';
  if (isPrefixed(pathname, ['/admin']) || pathname.startsWith('/api/admin'))
    return 'adminArea';
  if (
    isPrefixed(pathname, eifPagePrefixes) ||
    isPrefixed(pathname, eifApiPrefixes) ||
    pathname === '/'
  )
    return 'eifArea';
  return 'public';
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Redirect helpers — each has a single, named purpose
// ---------------------------------------------------------------------------

function safeCallbackUrl(request: NextRequest): string {
  // Build from the request's own pathname+search only — never from a query param.
  const { pathname, search } = request.nextUrl;
  return encodeURIComponent(pathname + search);
}

function redirectToAdminLogin(request: NextRequest, nonce: string) {
  const url = new URL(
    `/admin/login?callbackUrl=${safeCallbackUrl(request)}`,
    request.url
  );
  return withSecurityHeaders(NextResponse.redirect(url), nonce);
}

function redirectToEifLogin(request: NextRequest, nonce: string) {
  const url = new URL(
    `/login?callbackUrl=${safeCallbackUrl(request)}`,
    request.url
  );
  return withSecurityHeaders(NextResponse.redirect(url), nonce);
}

function redirectToPath(request: NextRequest, nonce: string, pathname: string) {
  return withSecurityHeaders(
    NextResponse.redirect(new URL(pathname, request.url)),
    nonce
  );
}

function denyApi(request: NextRequest, nonce: string) {
  return withSecurityHeaders(
    NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 }),
    nonce
  );
}

// ---------------------------------------------------------------------------
// Actor context — written once for any allowed authenticated response
// ---------------------------------------------------------------------------

interface ValidToken {
  id: string;
  email: string;
  role: string;
  isActive: true;
}

function buildActorResponse(
  request: NextRequest,
  actor: ValidToken,
  nonce: string
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-eskwelabs-actor-id', actor.id);
  requestHeaders.set('x-eskwelabs-actor-email', actor.email);
  requestHeaders.set('x-eskwelabs-actor-role', actor.role);
  requestHeaders.set('x-eskwelabs-actor-active', 'true');
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60
  };

  response.cookies.set('eskwelabs_actor_id', actor.id, cookieOpts);
  response.cookies.set('eskwelabs_actor_email', actor.email, cookieOpts);
  response.cookies.set('eskwelabs_actor_role', actor.role, cookieOpts);
  response.cookies.set('eskwelabs_actor_active', 'true', cookieOpts);

  return withSecurityHeaders(response, nonce);
}

// ---------------------------------------------------------------------------
// Unauthenticated handler
// ---------------------------------------------------------------------------

function handleUnauthenticated(
  request: NextRequest,
  kind: RouteKind,
  nonce: string
): NextResponse {
  const isApi = request.nextUrl.pathname.startsWith('/api');

  if (kind === 'adminLogin' || kind === 'eifLogin')
    return withSecurityHeaders(NextResponse.next(), nonce);
  if (kind === 'adminArea')
    return isApi
      ? denyApi(request, nonce)
      : redirectToAdminLogin(request, nonce);
  if (kind === 'eifArea')
    return isApi ? denyApi(request, nonce) : redirectToEifLogin(request, nonce);
  return withSecurityHeaders(NextResponse.next(), nonce); // public
}

// ---------------------------------------------------------------------------
// Authenticated handler
// ---------------------------------------------------------------------------

function handleAuthenticated(
  request: NextRequest,
  token: Record<string, unknown>,
  kind: RouteKind,
  nonce: string
): NextResponse {
  const id = token.id as string | undefined;
  const email = token.email as string | undefined;
  const role = token.role as string | undefined;
  const isActive = token.isActive;

  // Treat tokens missing required fields as unauthenticated
  if (!id || !email || !role || isActive !== true) {
    return handleUnauthenticated(request, kind, nonce);
  }

  const actor: ValidToken = {
    id,
    email: email.toLowerCase(),
    role,
    isActive: true
  };
  const isAdmin = role === 'admin';
  const isApi = request.nextUrl.pathname.startsWith('/api');

  if (kind === 'adminLogin') {
    if (isAdmin) {
      return redirectToPath(request, nonce, '/admin');
    }
    return redirectToPath(request, nonce, '/advisors');
  }

  if (kind === 'eifLogin') {
    return redirectToPath(request, nonce, isAdmin ? '/admin' : '/advisors');
  }

  if (kind === 'adminArea') {
    if (!isAdmin) {
      return isApi
        ? denyApi(request, nonce)
        : redirectToPath(request, nonce, '/advisors');
    }
    return buildActorResponse(request, actor, nonce);
  }

  if (kind === 'eifArea' && isAdmin) {
    return isApi
      ? denyApi(request, nonce)
      : redirectToPath(request, nonce, '/admin');
  }

  return buildActorResponse(request, actor, nonce);
}

// ---------------------------------------------------------------------------
// Middleware factory (token resolver injected for testability)
// ---------------------------------------------------------------------------

export function createMiddleware(
  getTokenFn: (req: NextRequest) => Promise<Record<string, unknown> | null>
) {
  return async function middlewareFn(
    request: NextRequest
  ): Promise<NextResponse> {
    const token = await getTokenFn(request);
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const kind = classifyRoute(request.nextUrl.pathname);

    if (!token) return handleUnauthenticated(request, kind, nonce);
    return handleAuthenticated(request, token, kind, nonce);
  };
}

export const middleware = createMiddleware(
  (req) =>
    getToken({ req, secret: process.env.AUTH_SECRET }) as Promise<Record<
      string,
      unknown
    > | null>
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
