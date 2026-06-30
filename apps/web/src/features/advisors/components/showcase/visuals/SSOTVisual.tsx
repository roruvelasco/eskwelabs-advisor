'use client';

import { motion } from 'motion/react';

import { EASE } from '../motion-constants';
import type { ThemeTokens } from '../types';
import { VisualFrame } from './VisualFrame';

// ─── SSOT Memo visual ─────────────────────────────────────────────────────────

export function SSOTVisual({
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
  const chips = [
    'Definitions',
    'Assumptions',
    'Decisions',
    'Open Questions',
    'Next Steps'
  ];
  const snippets = [
    '"The primary key for the Users table shall be…"',
    '→ All events tracked from session start',
    '✓ Revenue attributed at first invoice date'
  ];

  if (imageSrc) {
    return (
      <VisualFrame imageSrc={imageSrc} imageAlt={imageAlt} theme={theme} />
    );
  }

  return (
    <div className="relative" style={{ paddingBottom: '1.5rem' }}>
      {/* Shadow cards */}
      {[2, 1].map((depth) => (
        <motion.div
          key={depth}
          className="absolute rounded-2xl"
          style={{
            top: `${depth * 8}px`,
            left: `${depth * 10}px`,
            right: 0,
            height: '100%',
            background: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`
          }}
          initial={{ opacity: 0, y: depth * 10 }}
          animate={
            triggered
              ? { opacity: 1 - depth * 0.3, y: 0 }
              : { opacity: 0, y: depth * 10 }
          }
          transition={{ duration: 0.55, delay: 0.06 * depth, ease: EASE }}
        />
      ))}

      {/* Front card */}
      <VisualFrame theme={theme} className="relative z-10">
        <div
          className="mb-4 pb-3"
          style={{ borderBottom: `1px solid ${theme.dividerColor}` }}
        >
          <div
            className="mb-1 font-sans text-[10px] uppercase tracking-widest"
            style={{ color: theme.labelColor }}
          >
            SSOT Memo · Draft
          </div>
          <div
            className="font-serif text-base font-medium"
            style={{ color: theme.headingColor }}
          >
            Data Definitions &amp; Alignment
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          {snippets.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={
                triggered ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }
              }
              transition={{ duration: 0.45, delay: 0.25 + 0.1 * i }}
              className="rounded-lg px-3 py-2 font-sans text-xs leading-relaxed"
              style={{
                background: `${theme.accentFg}12`,
                color: theme.bodyColor
              }}
            >
              {s}
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={
                triggered
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.85 }
              }
              transition={{ duration: 0.35, delay: 0.45 + 0.06 * i }}
              className="rounded-full px-2.5 py-1 font-sans text-[10px] uppercase tracking-widest"
              style={{
                border: `1px solid ${theme.chipBorder}`,
                color: theme.chipText,
                background: theme.cardBg
              }}
            >
              {c}
            </motion.span>
          ))}
        </div>
      </VisualFrame>
    </div>
  );
}
