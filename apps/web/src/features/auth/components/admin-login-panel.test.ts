import { describe, expect, test } from 'bun:test';

describe('admin login panel', () => {
  test('keeps admin google login and omits user-login back link', async () => {
    const source = await Bun.file(
      import.meta.dir + '/admin-login-panel.tsx'
    ).text();

    expect(source).toContain("signIn('google-admin'");
    expect(source).toContain('Continue with Google');
    expect(source).not.toContain('Back to user login');
  });
});
