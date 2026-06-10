import { describe, expect, test } from 'bun:test';

import { roleCallbackUrl } from './callback-url';

describe('roleCallbackUrl', () => {
  test('keeps same-role relative paths', () => {
    expect(
      roleCallbackUrl('/admin/users?tab=active', '/admin', ['/admin'])
    ).toBe('/admin/users?tab=active');
  });

  test('falls back for cross-role paths', () => {
    expect(roleCallbackUrl('/advisors', '/admin', ['/admin'])).toBe('/admin');
  });

  test('falls back for external-looking paths', () => {
    expect(roleCallbackUrl('//evil.test/admin', '/admin', ['/admin'])).toBe(
      '/admin'
    );
  });
});
