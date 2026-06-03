import { describe, expect, test } from 'bun:test';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

describe('web app', () => {
  test('has a smoke test placeholder', () => {
    expect('eskwelabs-advisor').toContain('advisor');
  });

  test('sets a restrictive content security policy', () => {
    const request = new NextRequest('http://localhost/login');
    const response = middleware(request);
    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
  });
});
