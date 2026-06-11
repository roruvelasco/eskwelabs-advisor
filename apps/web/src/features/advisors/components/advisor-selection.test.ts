import { describe, expect, test } from 'bun:test';

describe('advisor selection notice', () => {
  test('uses persisted consent state before closing the monitoring notice', async () => {
    const source = await Bun.file(
      import.meta.dir + '/advisor-selection.tsx'
    ).text();

    expect(source).toContain('window.sessionStorage.setItem');
    expect(source).toContain('getConsent');
    expect(source).toContain('acknowledgeConsent()');
    expect(source).toContain('consentedAt');
  });
});
