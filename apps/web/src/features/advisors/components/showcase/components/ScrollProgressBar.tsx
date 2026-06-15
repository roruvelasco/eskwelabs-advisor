'use client';

import { motion, useScroll, useTransform } from 'motion/react';

// ─── Scroll progress bar ──────────────────────────────────────────────────────

export function ScrollProgressBar({ color }: { color: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div
      style={{ scaleX, transformOrigin: 'left', backgroundColor: color }}
      className="fixed bottom-0 left-0 right-0 z-50 h-[2px] transition-colors duration-500"
      aria-hidden="true"
    />
  );
}
