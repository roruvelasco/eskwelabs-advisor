'use client';

import { useEffect, useState } from 'react';
import {
  type MotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react';

import { GREEN, LIGHT } from '../advisor-data';
import type { ThemeTokens } from '../types';

// ─── useLiveTheme — scroll-linked theme for Dashboard ────────────────────────
// Returns a resolved ThemeTokens that updates on every animation frame as the
// user scrolls into/out of the Dashboard section. Uses React state so all
// consumers get plain strings (no MotionValue prop-threading needed).

export function useLiveTheme(
  sectionRef: React.RefObject<HTMLElement | null>,
): ThemeTokens {
  const { scrollYProgress } = useScroll({
    target: sectionRef as React.RefObject<HTMLElement>,
    // Starts interpolating as bottom of section enters viewport;
    // completes when top of section leaves viewport.
    offset: ['start end', 'end start'],
  });

  // Greenness factor: 0 = full LIGHT, 1 = full GREEN.
  // Going DOWN: stays fully green once the section center hits mid-viewport.
  // Going UP (scroll-back): transitions back to light only as the section top
  // rises above the viewport — matching the user's expected "stay green going
  // down, fade back going up" behavior.
  // offset ['start end', 'end start']:
  //   progress=0 → section top at viewport bottom (entering from below)
  //   progress=1 → section bottom at viewport top (leaving upward)
  const factor: MotionValue<number> = useTransform(
    scrollYProgress,
    [0, 0.15, 0.45, 0.80, 1],
    [0,    0,    1,    1,   0],
  );

  // Per-token interpolated MotionValues
  const mvBg = useTransform(factor, [0, 1], [LIGHT.bg, GREEN.bg]);
  const mvHeading = useTransform(factor, [0, 1], [LIGHT.headingColor, GREEN.headingColor]);
  const mvBody = useTransform(factor, [0, 1], [LIGHT.bodyColor, GREEN.bodyColor]);
  const mvMuted = useTransform(factor, [0, 1], [LIGHT.mutedColor, GREEN.mutedColor]);
  const mvCardBg = useTransform(factor, [0, 1], [LIGHT.cardBg, GREEN.cardBg]);
  const mvCardBorder = useTransform(factor, [0, 1], [LIGHT.cardBorder, GREEN.cardBorder]);
  const mvChipBorder = useTransform(factor, [0, 1], [LIGHT.chipBorder, GREEN.chipBorder]);
  const mvChipText = useTransform(factor, [0, 1], [LIGHT.chipText, GREEN.chipText]);
  const mvLabel = useTransform(factor, [0, 1], [LIGHT.labelColor, GREEN.labelColor]);
  const mvDivider = useTransform(factor, [0, 1], [LIGHT.dividerColor, GREEN.dividerColor]);
  const mvAccentFg = useTransform(factor, [0, 1], [LIGHT.accentFg, GREEN.accentFg]);
  const mvAccentText = useTransform(factor, [0, 1], [LIGHT.accentText, GREEN.accentText]);
  const mvCtaBg = useTransform(factor, [0, 1], [LIGHT.ctaBg, GREEN.ctaBg]);
  const mvNav = useTransform(factor, [0, 1], [LIGHT.navBg, GREEN.navBg]);
  const mvNavBorder = useTransform(factor, [0, 1], [LIGHT.navBorder, GREEN.navBorder]);
  const mvNavText = useTransform(factor, [0, 1], [LIGHT.navText, GREEN.navText]);
  const mvNavActive = useTransform(factor, [0, 1], [LIGHT.navActiveBg, GREEN.navActiveBg]);
  const mvNavActiveText = useTransform(factor, [0, 1], [LIGHT.navActiveText, GREEN.navActiveText]);
  const mvProgress = useTransform(factor, [0, 1], [LIGHT.progressBar, GREEN.progressBar]);

  // Sync MotionValues to React state so all consumers get plain strings.
  // Subscribe to scrollYProgress directly (more reliable than derived factor)
  // and sync once on mount to handle mid-scroll page loads / scroll-back cases.
  function snapshot(): ThemeTokens {
    return {
      bg: mvBg.get(),
      headingColor: mvHeading.get(),
      bodyColor: mvBody.get(),
      mutedColor: mvMuted.get(),
      cardBg: mvCardBg.get(),
      cardBorder: mvCardBorder.get(),
      chipBorder: mvChipBorder.get(),
      chipText: mvChipText.get(),
      labelColor: mvLabel.get(),
      dividerColor: mvDivider.get(),
      accentFg: mvAccentFg.get(),
      accentText: mvAccentText.get(),
      ctaBg: mvCtaBg.get(),
      ctaHoverBg: GREEN.ctaHoverBg,
      navBg: mvNav.get(),
      navBorder: mvNavBorder.get(),
      navText: mvNavText.get(),
      navActiveText: mvNavActiveText.get(),
      navActiveBg: mvNavActive.get(),
      progressBar: mvProgress.get(),
    };
  }

  const [t, setT] = useState<ThemeTokens>(() => snapshot());

  // Subscribe to scrollYProgress directly — fires reliably on both forward
  // and backward scroll, including when the section re-enters the viewport.
  useMotionValueEvent(scrollYProgress, 'change', () => setT(snapshot()));

  // Also sync on mount in case the element is already in a green position
  // (e.g. mid-scroll page reload or programmatic scroll).
  useEffect(() => {
    setT(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return t;
}
