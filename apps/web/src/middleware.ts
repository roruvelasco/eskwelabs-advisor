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

function csv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
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
  session: Record<string, unknown> | null
) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const pathname = request.nextUrl.pathname;
  const adminEmails = csv('ADMIN_EMAILS');
  const eifAllowlist = csv('EIF_ALLOWLIST_EMAILS');

  // Helper to create standard response with security headers
  const createResponse = (response: NextResponse) => {
    return withSecurityHeaders(response, nonce);
  };

  // If we have a session from NextAuth, convert to cookies and validate
  if (session?.user) {
    const user = session.user as Record<string, unknown>;
    const email = (user.email as string)?.toLowerCase() || '';
    const isAdmin = adminEmails.includes(email);

    // Double-check allow-list (defense-in-depth)
    if (!isAdmin && !eifAllowlist.includes(email)) {
      console.warn('middleware_allowlist_check_failed', { email });
      return createResponse(deny(request));
    }

    // Create actor for cookie storage
    const actor = {
      id: (user.id as string) || crypto.randomUUID(),
      email,
      role: isAdmin ? 'admin' : 'eif',
      isActive: true
    };

    // Create response with cookies
    const response = NextResponse.next();

    // Set auth cookies for downstream services
    response.cookies.set('eskwelabs_actor_id', actor.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 // 30 days
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

    response.cookies.set('eskwelabs_actor_active', 'true', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60
    });

    // Check if accessing protected routes
    const isAdminArea =
      isPrefixed(pathname, adminRoutes) || pathname.startsWith('/api/admin');
    const isEifArea =
      isPrefixed(pathname, eifRoutes) ||
      pathname.startsWith('/api/advisors') ||
      pathname.startsWith('/api/conversations') ||
      pathname.startsWith('/api/messages') ||
      pathname.startsWith('/api/chat-turn') ||
      pathname.startsWith('/api/consent');

    // Check authorization for protected routes
    if (isAdminArea && !isAdmin) {
      return createResponse(deny(request));
    }

    if (isEifArea && !isAdmin && !eifAllowlist.includes(email)) {
      return createResponse(deny(request));
    }

    // Set headers for downstream Hono services
    response.headers.set('x-nonce', nonce);
    response.headers.set('x-eskwelabs-actor-id', actor.id);
    response.headers.set('x-eskwelabs-actor-email', actor.email);
    response.headers.set('x-eskwelabs-actor-role', actor.role);
    response.headers.set('x-eskwelabs-actor-active', String(actor.isActive));
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

  // No session - check if route is protected
  const isProtected = [
    ...eifRoutes,
    ...adminRoutes,
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

  // Public route - pass through with security headers
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
  const session = token
    ? {
        user: {
          id: token.sub ?? (token as { id?: string }).id ?? crypto.randomUUID(),
          email: token.email,
          name: token.name,
          image: token.picture
        }
      }
    : null;

  return updateMiddleware(request, session as Record<string, unknown> | null);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
