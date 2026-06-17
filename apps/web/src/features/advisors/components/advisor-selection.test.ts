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

describe('advisor selection hydration', () => {
  test('advisor sections render outside the advisors query loading state', async () => {
    const advisorSource = await Bun.file(
      import.meta.dir + '/showcase/AdvisorShowcase.tsx'
    ).text();

    expect(advisorSource).toContain('ORDERED_IDS.map');
    expect(advisorSource).toContain(
      '<HeroSection sectionRefs={sectionRefs} />'
    );
    expect(advisorSource).not.toContain('DotWave');
    expect(advisorSource).not.toContain('isLoading ? (');
    expect(advisorSource).not.toContain('Could not load advisors.');
  });

  test('advisor sections receive explicit CTA readiness state', async () => {
    const showcaseSource = await Bun.file(
      import.meta.dir + '/showcase/AdvisorShowcase.tsx'
    ).text();
    const sectionSource = await Bun.file(
      import.meta.dir + '/showcase/components/AdvisorSection.tsx'
    ).text();

    expect(showcaseSource).toContain('getAdvisorCtaState');
    expect(showcaseSource).toContain("status: 'loading'");
    expect(showcaseSource).toContain("status: 'error'");
    expect(showcaseSource).toContain("status: 'available'");
    expect(sectionSource).toContain("ctaState.status === 'available'");
    expect(sectionSource).toContain('aria-disabled="true"');
  });
});
