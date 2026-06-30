'use client';

import { motion } from 'motion/react';

import { EASE } from '../motion-constants';
import type { ThemeTokens } from '../types';
import { VisualFrame } from './VisualFrame';

// ─── Dashboard visual ─────────────────────────────────────────────────────────

export function DashboardVisual({
  triggered,
  theme,
  imageSrc,
  imageAlt
}: {
  triggered: boolean;
  theme: ThemeTokens;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const bars = [65, 80, 45, 90, 72, 55, 88];
  const linePoints = '0,60 20,45 40,55 60,30 80,40 100,20';

  if (imageSrc) {
    return (
      <VisualFrame imageSrc={imageSrc} imageAlt={imageAlt} theme={theme} />
    );
  }

  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5 shadow-sm"
      style={{
        background: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="font-sans text-xs uppercase tracking-widest"
          style={{ color: theme.labelColor }}
        >
          Dashboard Preview
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-sans text-[10px]"
          style={{ background: `${theme.accentFg}20`, color: theme.labelColor }}
        >
          Live
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sessions', value: '2,481' },
          { label: 'Decisions', value: '94' },
          { label: 'Clarity', value: '98%' }
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={
              triggered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }
            }
            transition={{ duration: 0.45, delay: 0.08 * i, ease: EASE }}
            className="flex flex-col gap-0.5 rounded-xl p-3"
            style={{
              background: theme.bg,
              border: `1px solid ${theme.cardBorder}`
            }}
          >
            <span
              className="font-serif text-lg font-medium"
              style={{ color: theme.headingColor }}
            >
              {m.value}
            </span>
            <span
              className="font-sans text-[10px] uppercase tracking-widest"
              style={{ color: theme.labelColor }}
            >
              {m.label}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Bar chart */}
      <div
        className="flex items-end gap-1.5 rounded-xl p-4"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.cardBorder}`
        }}
      >
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-sm"
            style={{ backgroundColor: theme.accentFg, minHeight: 0 }}
            initial={{ height: 0 }}
            animate={triggered ? { height: `${h * 0.7}px` } : { height: 0 }}
            transition={{ duration: 0.55, delay: 0.04 * i, ease: EASE }}
          />
        ))}
      </div>

      {/* Line chart */}
      <div
        className="overflow-hidden rounded-xl p-4"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.cardBorder}`
        }}
      >
        <svg
          viewBox="0 0 100 70"
          className="h-14 w-full"
          preserveAspectRatio="none"
        >
          <motion.polyline
            points={linePoints}
            fill="none"
            style={{ stroke: theme.accentFg }}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={
              triggered
                ? { pathLength: 1, opacity: 1 }
                : { pathLength: 0, opacity: 0 }
            }
            transition={{ duration: 1.1, delay: 0.25, ease: 'easeInOut' }}
          />
          <motion.polygon
            points={`${linePoints} 100,70 0,70`}
            style={{ fill: theme.accentFg }}
            fillOpacity="0.08"
            initial={{ opacity: 0 }}
            animate={triggered ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.7, delay: 0.75 }}
          />
        </svg>
      </div>
    </div>
  );
}
