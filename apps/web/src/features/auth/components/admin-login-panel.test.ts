import { describe, expect, test } from 'bun:test';

describe('admin login panel', () => {
  test('keeps admin google login and omits user-login back link', async () => {
    const source = await Bun.file(
      import.meta.dir + '/admin-login-panel.tsx'
    ).text();

    expect(source).toContain("googleProviderId: 'google-admin'");
    expect(source).toContain("credentialsProviderId: 'credentials-admin'");
    expect(source).toContain("heading: 'Admin Portal'");
    expect(source).not.toContain('Back to user login');
  });

  test('delegates to AuthLoginPanel shared component', async () => {
    const source = await Bun.file(
      import.meta.dir + '/admin-login-panel.tsx'
    ).text();

    expect(source).toContain('import { AuthLoginPanel');
    expect(source).toContain('<AuthLoginPanel config={adminConfig}');
  });
});
