'use client';

import { useInView } from 'motion/react';

// ─── useRepeatInView ──────────────────────────────────────────────────────────
// A thin wrapper around useInView with once: false so the element re-animates
// every time it enters the viewport.

export function useRepeatInView(
  ref: React.RefObject<Element | null>,
  amount: number,
) {
  return useInView(ref, { amount, once: false });
}
