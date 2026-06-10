import { describe, expect, test } from 'bun:test';

describe('advisor selection notice', () => {
  test('uses browser session state to show the monitoring notice once per session', async () => {
    const source = await Bun.file(
      import.meta.dir + '/advisor-selection.tsx'
    ).text();

    expect(source).toContain('window.sessionStorage.getItem');
    expect(source).toContain('window.sessionStorage.setItem');
    expect(source).toContain('acknowledgeConsent()');
    expect(source).not.toContain('getConsent');
  });
});
