'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DotWave } from '@eskwelabs-advisor/ui';

import { ConsentDialog } from '@/features/auth/components/consent-dialog';
import { acknowledgeConsent, getConsent } from '@/lib/domains/auth/api';
import { advisorsQuery } from '@/lib/domains/advisors/queries';

import { GREEN, LIGHT, ORDERED_IDS } from './advisor-data';
import type { ThemeTokens } from './types';
import { AdvisorSection } from './components/AdvisorSection';
import { HeroSection } from './components/HeroSection';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { StickyNav } from './components/StickyNav';

// ─── Consent session key ──────────────────────────────────────────────────────

const CONSENT_KEY = 'eskwelabs-advisor:monitoring-notice-seen';

// ─── AdvisorSelection (page root) ────────────────────────────────────────────

export function AdvisorSelection() {
  const [consentOpen, setConsentOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consentError, setConsentError] = useState<string>();

  const [navVisible, setNavVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Theme observed from the currently active advisor section
  const [navTheme, setNavTheme] = useState<ThemeTokens>(LIGHT);

  const sectionRefs = useRef<(HTMLElement | null)[]>([null, null, null]);

  const { data: advisorsResponse, isLoading, isError } = useQuery(advisorsQuery);
  const { isLoading: isConsentLoading } = useQuery({
    queryKey: ['consent'],
    queryFn: getConsent,
  });

  const advisors = advisorsResponse?.data ?? [];
  const advisorMap = Object.fromEntries(advisors.map((a) => [a.id, a]));

  useEffect(() => {
    if (isConsentLoading) return;
    const seen = window.sessionStorage.getItem(CONSENT_KEY) === 'true';
    setConsentOpen(!seen);
  }, [isConsentLoading]);

  // Track scroll: sticky nav + active section + nav theme.
  // Nav appears only after the full hero sentinel (280svh) is past the viewport,
  // so it never overlaps with the hero's own top bar.
  useEffect(() => {
    function onScroll() {
      const heroEl = document.getElementById('hero');
      // heroEl.offsetHeight = 280svh worth of pixels
      const heroBottom = heroEl ? heroEl.offsetTop + heroEl.offsetHeight : window.innerHeight * 2.8;
      setNavVisible(window.scrollY + window.innerHeight > heroBottom);

      let current = -1;
      sectionRefs.current.forEach((el, i) => {
        if (!el) return;
        if (el.getBoundingClientRect().top <= window.innerHeight * 0.55) current = i;
      });
      setActiveIndex(current);

      // Nav theme: green when deep enough into the dashboard section
      if (current === 0) {
        const dashEl = sectionRefs.current[0];
        if (dashEl) {
          const rect = dashEl.getBoundingClientRect();
          const total = dashEl.offsetHeight + window.innerHeight;
          const traveled = window.innerHeight - rect.top;
          const progress = Math.max(0, Math.min(1, traveled / total));
          const factor = Math.max(0, Math.min(1, (progress - 0.15) / 0.25));
          setNavTheme(factor > 0.5 ? GREEN : LIGHT);
        }
      } else {
        setNavTheme(LIGHT);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setConsentError(undefined);
    try {
      await acknowledgeConsent();
    } catch {
      setConsentError('Could not record acknowledgement. Please try again.');
      setIsAcknowledging(false);
      return;
    }
    try {
      window.sessionStorage.setItem(CONSENT_KEY, 'true');
    } catch {
      // ignore
    }
    setAcknowledged(true);
    setTimeout(() => setConsentOpen(false), 1100);
    setIsAcknowledging(false);
  };

  return (
    <>
      <ConsentDialog
        open={consentOpen}
        acknowledged={acknowledged}
        isAcknowledging={isAcknowledging}
        error={consentError}
        onAcknowledge={handleAcknowledge}
      />

      <ScrollProgressBar color={navTheme.progressBar} />

      <StickyNav
        visible={navVisible}
        activeIndex={activeIndex}
        sectionRefs={sectionRefs}
        navTheme={navTheme}
      />

      <main>
        <HeroSection sectionRefs={sectionRefs} />

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center" style={{ background: LIGHT.bg }}>
            <DotWave size={40} speed={1} color="#4a8a69" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[40vh] items-center justify-center" style={{ background: LIGHT.bg }}>
            <p className="font-sans text-sm" style={{ color: LIGHT.bodyColor }}>
              Could not load advisors.
            </p>
          </div>
        ) : (
          ORDERED_IDS.map((id, i) => (
            <AdvisorSection
              key={id}
              advisorId={id}
              advisor={advisorMap[id]}
              isEven={i % 2 === 0}
              sectionRef={(el) => { sectionRefs.current[i] = el; }}
              // Uncomment to replace abstract visual with a real image:
              // imageSrc="/images/dashboard-preview.jpg"
              // imageAlt="Dashboard preview"
            />
          ))
        )}
      </main>
    </>
  );
}
