'use client';

import { motion } from 'motion/react';
import CountUp from 'react-countup';

import { EASE } from '../motion-constants';
import type { ThemeTokens } from '../types';

// ─── Fade + rise variant — used with `custom` prop for staggered delays ───────
// once: false consumers re-animate on every entry.
import { rm } from '../motion-constants';
import type { Variants } from 'motion/react';

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: rm ? 0 : 22 },
  visible: (d: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay: d },
  }),
};

// ─── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({
  value,
  suffix,
  label,
  delay,
  triggered,
  theme,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
  triggered: boolean;
  theme: ThemeTokens;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      animate={triggered ? 'visible' : 'hidden'}
      className="flex flex-col gap-1 pt-4"
      style={{ borderTop: `1px solid ${theme.dividerColor}` }}
    >
      <span
        className="font-serif text-4xl font-medium tracking-tight"
        style={{ color: theme.accentText }}
      >
        {triggered ? (
          <CountUp end={value} duration={1.4} delay={delay} suffix={suffix} />
        ) : (
          '0'
        )}
      </span>
      <span
        className="text-xs uppercase tracking-widest"
        style={{ color: theme.labelColor }}
      >
        {label}
      </span>
    </motion.div>
  );
}
