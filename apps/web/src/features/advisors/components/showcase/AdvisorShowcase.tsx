'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { advisorsQuery } from '@/lib/domains/advisors/queries';

import { GREEN, LIGHT, ORDERED_IDS } from './advisor-data';
import type { Advisor, AdvisorCtaState, ThemeTokens } from './types';
import { AdvisorSection } from './components/AdvisorSection';
import { HeroSection } from './components/HeroSection';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { StickyNav } from './components/StickyNav';

function getAdvisorCtaState(
  advisor: Advisor | undefined,
  isLoading: boolean,
  isError: boolean,
  retry: () => void
): AdvisorCtaState {
  if (isLoading) return { status: 'loading' };
  if (isError) return { status: 'error', retry };
  if (advisor?.isActive && advisor.availability?.status === 'available') {
    return { status: 'available', href: `/chat?advisor=${advisor.id}` };
  }
  return { status: 'unavailable' };
}

// ─── AdvisorSelection (page root) ────────────────────────────────────────────

export function AdvisorSelection() {
  const [navVisible, setNavVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Theme observed from the currently active advisor section
  const [navTheme, setNavTheme] = useState<ThemeTokens>(LIGHT);

  const sectionRefs = useRef<(HTMLElement | null)[]>([null, null, null]);

  const {
    data: advisorsResponse,
    isLoading,
    isError,
    refetch
  } = useQuery(advisorsQuery);

  const advisors = advisorsResponse?.data ?? [];
  const advisorMap = Object.fromEntries(advisors.map((a) => [a.id, a]));

  // Track scroll: sticky nav + active section + nav theme.
  // Nav appears only after the full hero sentinel (280svh) is past the viewport,
  // so it never overlaps with the hero's own top bar.
  useEffect(() => {
    function onScroll() {
      const heroEl = document.getElementById('hero');
      // heroEl.offsetHeight = 280svh worth of pixels
      const heroBottom = heroEl
        ? heroEl.offsetTop + heroEl.offsetHeight
        : window.innerHeight * 2.8;
      setNavVisible(window.scrollY + window.innerHeight > heroBottom);

      let current = -1;
      sectionRefs.current.forEach((el, i) => {
        if (!el) return;
        if (el.getBoundingClientRect().top <= window.innerHeight * 0.55)
          current = i;
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

  return (
    <>
      <ScrollProgressBar color={navTheme.progressBar} />

      <StickyNav
        visible={navVisible}
        activeIndex={activeIndex}
        sectionRefs={sectionRefs}
        navTheme={navTheme}
      />

      <main>
        <HeroSection sectionRefs={sectionRefs} />

        {ORDERED_IDS.map((id, i) => {
          const advisor = advisorMap[id];
          return (
            <AdvisorSection
              key={id}
              advisorId={id}
              advisor={advisor}
              ctaState={getAdvisorCtaState(
                advisor,
                isLoading,
                isError,
                refetch
              )}
              isEven={i % 2 === 0}
              sectionRef={(el) => {
                sectionRefs.current[i] = el;
              }}
              // Uncomment to replace abstract visual with a real image:
              // imageSrc="/images/dashboard-preview.jpg"
              // imageAlt="Dashboard preview"
            />
          );
        })}
      </main>
    </>
  );
}
