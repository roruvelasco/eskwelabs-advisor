import { describe, expect, test } from 'bun:test';

describe('chat consent notice', () => {
  test('consent lives in the chat shell, not in advisor selection', async () => {
    const advisorSource = await Bun.file(
      import.meta.dir + '/showcase/AdvisorShowcase.tsx'
    ).text();

    expect(advisorSource).not.toContain('window.sessionStorage.setItem');
    expect(advisorSource).not.toContain('window.sessionStorage.getItem');
    expect(advisorSource).not.toContain('getConsent');
    expect(advisorSource).not.toContain('acknowledgeConsent()');
  });

  test('chat shell uses persisted consent state before closing the monitoring notice', async () => {
    const chatSource = await Bun.file(
      import.meta.dir + '/../../chat/components/new-chat-shell.tsx'
    ).text();

    expect(chatSource).toContain('window.sessionStorage.setItem');
    expect(chatSource).toContain('window.sessionStorage.getItem');
    expect(chatSource).toContain('getConsent');
    expect(chatSource).toContain('acknowledgeConsent()');
  });
});
