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

function shouldLogAuthDiagnostics() {
  return process.env.NODE_ENV !== 'production';
}

function isPrefixed(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function classifyRoute(pathname: string): RouteKind {
  if (pathname === '/admin/login') return 'adminLogin';
  if (pathname === '/login') return 'eifLogin';
  if (isPrefixed(pathname, ['/admin']) || isPrefixed(pathname, ['/api/admin']))
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

function returnToParam(request: NextRequest) {
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return `?returnTo=${encodeURIComponent(returnTo)}`;
}

function redirectToAdminLogin(request: NextRequest, nonce: string) {
  return redirectToPath(
    request,
    nonce,
    `/admin/login${returnToParam(request)}`
  );
}

function redirectToEifLogin(request: NextRequest, nonce: string) {
  return redirectToPath(request, nonce, `/login${returnToParam(request)}`);
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

async function signActorPayload(
  actor: ValidToken,
  method: string,
  path: string,
  secret: string
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const payload = `${actor.id}:${actor.email}:${actor.role}:true:${method}:${path}:${timestamp}:${nonce}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return { signature, timestamp, nonce };
}

async function buildActorResponse(
  request: NextRequest,
  actor: ValidToken,
  nonce: string,
  cleanHeaders: Headers
) {
  const forwardingSecret = process.env.ACTOR_FORWARDING_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevDefault =
    forwardingSecret === 'dev-actor-forwarding-secret-change-in-prod';

  if (forwardingSecret && !(isProduction && isDevDefault)) {
    const {
      signature,
      timestamp,
      nonce: actorNonce
    } = await signActorPayload(
      actor,
      request.method,
      request.nextUrl.pathname,
      forwardingSecret
    );
    cleanHeaders.set('x-eskwelabs-actor-signature', signature);
    cleanHeaders.set('x-eskwelabs-actor-timestamp', timestamp);
    cleanHeaders.set('x-eskwelabs-actor-nonce', actorNonce);
  }

  cleanHeaders.set('x-eskwelabs-actor-id', actor.id);
  cleanHeaders.set('x-eskwelabs-actor-email', actor.email);
  cleanHeaders.set('x-eskwelabs-actor-role', actor.role);
  cleanHeaders.set('x-eskwelabs-actor-active', 'true');
  cleanHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: cleanHeaders } });
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
  nonce: string,
  cleanHeaders: Headers
): NextResponse {
  const isApi = request.nextUrl.pathname.startsWith('/api');

  if (kind === 'adminLogin' || kind === 'eifLogin')
    return withSecurityHeaders(
      NextResponse.next({ request: { headers: cleanHeaders } }),
      nonce
    );
  if (kind === 'adminArea')
    return isApi
      ? denyApi(request, nonce)
      : redirectToAdminLogin(request, nonce);
  if (kind === 'eifArea')
    return isApi ? denyApi(request, nonce) : redirectToEifLogin(request, nonce);
  return withSecurityHeaders(
    NextResponse.next({ request: { headers: cleanHeaders } }),
    nonce
  ); // public
}

// ---------------------------------------------------------------------------
// Authenticated handler
// ---------------------------------------------------------------------------

async function handleAuthenticated(
  request: NextRequest,
  token: Record<string, unknown>,
  kind: RouteKind,
  nonce: string,
  cleanHeaders: Headers
): Promise<NextResponse> {
  const id = token.id as string | undefined;
  const email = token.email as string | undefined;
  const role = token.role as string | undefined;
  const isActive = token.isActive;

  // Treat tokens missing required fields as unauthenticated
  if (!id || !email || !role || isActive !== true) {
    return handleUnauthenticated(request, kind, nonce, cleanHeaders);
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
    return await buildActorResponse(request, actor, nonce, cleanHeaders);
  }

  if (kind === 'eifArea' && isAdmin) {
    return isApi
      ? denyApi(request, nonce)
      : redirectToPath(request, nonce, '/admin');
  }

  return await buildActorResponse(request, actor, nonce, cleanHeaders);
}

// ---------------------------------------------------------------------------
// Middleware factory (token resolver injected for testability)
// ---------------------------------------------------------------------------

function stripActorHeaders(headers: Headers) {
  const clean = new Headers(headers);
  clean.delete('x-eskwelabs-actor-id');
  clean.delete('x-eskwelabs-actor-email');
  clean.delete('x-eskwelabs-actor-role');
  clean.delete('x-eskwelabs-actor-active');
  clean.delete('x-eskwelabs-actor-signature');
  clean.delete('x-eskwelabs-actor-timestamp');
  clean.delete('x-eskwelabs-actor-nonce');
  return clean;
}

export function createMiddleware(
  getTokenFn: (req: NextRequest) => Promise<Record<string, unknown> | null>
) {
  return async function middlewareFn(
    request: NextRequest
  ): Promise<NextResponse> {
    const cleanHeaders = stripActorHeaders(request.headers);
    const token = await getTokenFn(request);
    const nonce = crypto.randomUUID().replaceAll('-', '');
    const kind = classifyRoute(request.nextUrl.pathname);

    if (!token)
      return handleUnauthenticated(request, kind, nonce, cleanHeaders);
    return await handleAuthenticated(request, token, kind, nonce, cleanHeaders);
  };
}

export const middleware = createMiddleware(async (req) => {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

  const cookieNames = req.cookies.getAll().map(({ name }) => name);

  const token = (await getToken({
    req,
    secret,
    secureCookie: req.nextUrl.protocol === 'https:'
  })) as Record<string, unknown> | null;

  if (shouldLogAuthDiagnostics()) {
    console.info('middleware_token_probe', {
      path: req.nextUrl.pathname,
      cookieCount: cookieNames.length,
      hasSessionCookie: cookieNames.some((name) =>
        name.includes('next-auth.session-token')
      ),
      hasToken: Boolean(token),
      hasTokenId:
        typeof token?.id === 'string' || typeof token?.sub === 'string',
      hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
      hasAuthSecret: Boolean(process.env.AUTH_SECRET)
    });
  }

  return token;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
