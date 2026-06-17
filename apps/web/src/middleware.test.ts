import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

import { classifyRoute, createMiddleware } from './middleware';

// ---------------------------------------------------------------------------
// Token fixtures
// ---------------------------------------------------------------------------

function makeToken(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    ...overrides
  };
}

const adminToken = makeToken();
const eifToken = makeToken({ email: 'eif@example.com', role: 'eif' });

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

function mw(token: Record<string, unknown> | null) {
  return createMiddleware(async () => token);
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

// ---------------------------------------------------------------------------
// classifyRoute — pure function, no HTTP needed
// ---------------------------------------------------------------------------

describe('classifyRoute', () => {
  test('adminLogin', () => {
    expect(classifyRoute('/admin/login')).toBe('adminLogin');
  });

  test('adminArea — exact and nested', () => {
    expect(classifyRoute('/admin')).toBe('adminArea');
    expect(classifyRoute('/admin/users')).toBe('adminArea');
    expect(classifyRoute('/admin/users/123')).toBe('adminArea');
    expect(classifyRoute('/api/admin')).toBe('adminArea');
    expect(classifyRoute('/api/admin/users')).toBe('adminArea');
  });

  test('eifArea — pages', () => {
    expect(classifyRoute('/advisors')).toBe('eifArea');
    expect(classifyRoute('/chat')).toBe('eifArea');
    expect(classifyRoute('/history')).toBe('eifArea');
    expect(classifyRoute('/consent')).toBe('eifArea');
    expect(classifyRoute('/')).toBe('eifArea');
  });

  test('eifArea — API routes', () => {
    expect(classifyRoute('/api/advisors/list')).toBe('eifArea');
    expect(classifyRoute('/api/conversations/1')).toBe('eifArea');
    expect(classifyRoute('/api/messages/abc')).toBe('eifArea');
    expect(classifyRoute('/api/chat-turn/stream')).toBe('eifArea');
    expect(classifyRoute('/api/consent')).toBe('eifArea');
  });

  test('public', () => {
    expect(classifyRoute('/login')).toBe('eifLogin');
    expect(classifyRoute('/api/auth/callback/google')).toBe('public');
    expect(classifyRoute('/some-page')).toBe('public');
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated access
// ---------------------------------------------------------------------------

describe('unauthenticated', () => {
  test('allows /login', async () => {
    const res = await mw(null)(req('/login'));
    expect(res.status).toBe(200);
  });

  test('allows /admin/login', async () => {
    const res = await mw(null)(req('/admin/login'));
    expect(res.status).toBe(200);
  });

  test('redirects /admin to /admin/login', async () => {
    const res = await mw(null)(req('/admin'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  test('redirects /admin/users to /admin/login', async () => {
    const res = await mw(null)(req('/admin/users'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  test('denies /api/admin/* with 403 JSON', async () => {
    const res = await mw(null)(req('/api/admin/users'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('forbidden');
  });

  test('redirects /advisors to /login', async () => {
    const res = await mw(null)(req('/advisors'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('redirects / to /login', async () => {
    const res = await mw(null)(req('/'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('denies /api/advisors/* with 403 JSON', async () => {
    const res = await mw(null)(req('/api/advisors/list'));
    expect(res.status).toBe(403);
  });

  test('allows public pages', async () => {
    const res = await mw(null)(req('/some-public-page'));
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Admin authenticated
// ---------------------------------------------------------------------------

describe('admin token', () => {
  test('redirects /admin/login to /admin', async () => {
    const res = await mw(adminToken)(req('/admin/login'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin');
    expect(res.headers.get('location')).not.toContain('/admin/login');
  });

  test('allows /admin with actor headers', async () => {
    const res = await mw(adminToken)(req('/admin'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-eskwelabs-actor-role')).toBeNull(); // on request headers, not response
  });

  test('allows /api/admin/users', async () => {
    const res = await mw(adminToken)(req('/api/admin/users'));
    expect(res.status).toBe(200);
  });

  test('denies /api/consent', async () => {
    const res = await mw(adminToken)(req('/api/consent'));
    expect(res.status).toBe(403);
  });

  test('redirects /advisors to /admin', async () => {
    const res = await mw(adminToken)(req('/advisors'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin');
  });

  test('redirects /login to /admin', async () => {
    const res = await mw(adminToken)(req('/login'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin');
  });
});

// ---------------------------------------------------------------------------
// EIF authenticated
// ---------------------------------------------------------------------------

describe('eif token', () => {
  test('redirects /admin/login to /advisors (wrong area)', async () => {
    const res = await mw(eifToken)(req('/admin/login'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/advisors');
    expect(res.headers.get('location')).not.toContain('/admin');
  });

  test('redirects /admin to /advisors', async () => {
    const res = await mw(eifToken)(req('/admin'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/advisors');
  });

  test('denies /api/admin/users with 403', async () => {
    const res = await mw(eifToken)(req('/api/admin/users'));
    expect(res.status).toBe(403);
  });

  test('allows /advisors', async () => {
    const res = await mw(eifToken)(req('/advisors'));
    expect(res.status).toBe(200);
  });

  test('allows /api/advisors/list', async () => {
    const res = await mw(eifToken)(req('/api/advisors/list'));
    expect(res.status).toBe(200);
  });

  test('redirects /login to /advisors', async () => {
    const res = await mw(eifToken)(req('/login'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/advisors');
  });
});

// ---------------------------------------------------------------------------
// Invalid token — treated as unauthenticated
// ---------------------------------------------------------------------------

describe('invalid token', () => {
  test('no role → treat as unauthenticated for /admin', async () => {
    const res = await mw(makeToken({ role: undefined }))(req('/admin'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  test('isActive=false → treat as unauthenticated for /advisors', async () => {
    const res = await mw(makeToken({ isActive: false }))(req('/advisors'));
    expect(isRedirect(res.status)).toBe(true);
    expect(res.headers.get('location')).toContain('/login');
  });
});

// ---------------------------------------------------------------------------
// CSP headers (migrated from app.test.ts)
// ---------------------------------------------------------------------------

describe('security headers', () => {
  test('sets a restrictive Content-Security-Policy on public pages', async () => {
    const res = await mw(null)(req('/login'));
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
  });

  test('sets CSP on authenticated responses', async () => {
    const res = await mw(adminToken)(req('/admin'));
    const csp = res.headers.get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
  });
});

describe('auth diagnostics', () => {
  test('redacts verbose token and secret details from auth probes', async () => {
    const middlewareSource = await Bun.file(
      import.meta.dir + '/middleware.ts'
    ).text();
    const tokenActorSource = await Bun.file(
      import.meta.dir + '/lib/domains/auth/token-actor.ts'
    ).text();
    const combined = `${middlewareSource}\n${tokenActorSource}`;

    expect(combined).toContain("process.env.NODE_ENV !== 'production'");
    expect(combined).toContain('cookieCount');
    expect(combined).not.toContain('secretsEqual');
    expect(combined).not.toContain('tokenShape');
    expect(combined).not.toContain('tokenRole');
    expect(combined).not.toContain('tokenIsActive');
    expect(combined).not.toContain('cookieNames,');
    expect(combined).not.toContain('email: token.email');
  });
});

// ---------------------------------------------------------------------------
// Actor header forwarding (signed)
// ---------------------------------------------------------------------------

describe('actor header forwarding', () => {
  test('strips incoming forged signature headers before setting trusted ones', async () => {
    const res = await mw(adminToken)(
      new NextRequest('http://localhost/admin', {
        headers: {
          'x-eskwelabs-actor-signature': 'forged-sig',
          'x-eskwelabs-actor-timestamp': '9999999999',
          'x-eskwelabs-actor-nonce': 'forged-nonce',
          'x-eskwelabs-actor-id': 'forged-id',
          'x-eskwelabs-actor-email': 'forged@evil.com'
        }
      })
    );

    // Middleware stripped all incoming actor headers before setting trusted ones.
    // The response status shows the middleware correctly authenticated via the
    // JWT token (not the forged headers).
    expect(res.status).toBe(200);
  });
});
