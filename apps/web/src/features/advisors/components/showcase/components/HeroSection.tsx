'use client';

import { useRef } from 'react';
import { GrainOverlay } from '@eskwelabs-advisor/ui';
import { motion, useScroll, useTransform } from 'motion/react';

import { ADVISOR_CONFIG, LIGHT, ORDERED_IDS } from '../advisor-data';
import { rm } from '../motion-constants';

// ─── Hero — pinned scroll reveal ──────────────────────────────────────────────
// A tall sentinel div (280svh) with a sticky inner panel.
// useScroll drives sequential element reveals as the user scrolls.

export function HeroSection({
  sectionRefs,
}: {
  sectionRefs: React.MutableRefObject<(HTMLElement | null)[]>;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sentinelRef,
    offset: ['start start', 'end end'],
  });

  function scrollToSection(i: number) {
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // "Choose the advisor" — always visible from scroll=0.
  // "built for your next decision." — reveals on first scroll movement.
  // Subtext, pills, and cue each reveal in sequence after.
  // rm = no y transforms.

  const line2O = useTransform(scrollYProgress, [0.02, 0.12], [0, 1]);
  const line2Y = useTransform(scrollYProgress, [0.02, 0.12], rm ? [0, 0] : [20, 0]);

  const bodyO = useTransform(scrollYProgress, [0.15, 0.27], [0, 1]);
  const bodyY = useTransform(scrollYProgress, [0.15, 0.27], rm ? [0, 0] : [16, 0]);

  const pill0O = useTransform(scrollYProgress, [0.30, 0.40], [0, 1]);
  const pill0Y = useTransform(scrollYProgress, [0.30, 0.40], rm ? [0, 0] : [12, 0]);
  const pill1O = useTransform(scrollYProgress, [0.35, 0.44], [0, 1]);
  const pill1Y = useTransform(scrollYProgress, [0.35, 0.44], rm ? [0, 0] : [12, 0]);
  const pill2O = useTransform(scrollYProgress, [0.40, 0.49], [0, 1]);
  const pill2Y = useTransform(scrollYProgress, [0.40, 0.49], rm ? [0, 0] : [12, 0]);

  const pillOs = [pill0O, pill1O, pill2O];
  const pillYs = [pill0Y, pill1Y, pill2Y];

  const cueO = useTransform(scrollYProgress, [0.53, 0.62], [0, 1]);

  const t = LIGHT;

  return (
    <div ref={sentinelRef} id="hero" style={{ height: '280svh' }}>
      <GrainOverlay
        intensity="subtle"
        className="sticky top-0 min-h-[100svh]"
        style={{ background: t.bg }}
      >
        <div className="flex min-h-[100svh] flex-col justify-between overflow-hidden px-6 py-10 md:px-16 md:py-14">
        {/* Top bar — always visible */}
        <div
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: `1px solid ${t.dividerColor}` }}
        >
          <span className="font-sans text-xs uppercase tracking-widest" style={{ color: t.mutedColor }}>
            Eskwelabs Advisor
          </span>
          <span className="font-sans text-xs uppercase tracking-widest" style={{ color: t.labelColor }}>
            AI Specialist Selection
          </span>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col justify-center py-12 md:py-16">
          {/*
            Split headline:
            Line 1 "Choose the advisor" — static, visible from scroll=0.
            Line 2 "built for your next decision." — fades + rises on first scroll.
          */}
          <h1
            style={{ color: t.headingColor, fontSize: 'clamp(2.5rem, 6vw, 5.5rem)' }}
            className="max-w-4xl font-serif font-medium leading-[1.04] tracking-tight"
          >
            Choose the advisor{' '}
            <motion.span
              style={{ opacity: line2O, y: line2Y, display: 'inline-block' }}
            >
              built for your next decision.
            </motion.span>
          </h1>

          {/* Subtext */}
          <motion.p
            style={{ opacity: bodyO, y: bodyY, color: t.bodyColor }}
            className="mt-6 max-w-lg font-sans text-base leading-relaxed md:text-lg"
          >
            Three AI specialists designed to help you structure data, align stakeholders, and
            turn analysis into action.
          </motion.p>

          {/* Advisor index pills */}
          <div className="mt-12 flex flex-wrap gap-3">
            {ORDERED_IDS.map((id, i) => {
              const cfg = ADVISOR_CONFIG[id];
              return (
                <motion.button
                  key={id}
                  style={{
                    opacity: pillOs[i],
                    y: pillYs[i],
                    border: `1px solid ${t.chipBorder}`,
                    background: 'rgba(255,255,255,0.6)',
                    color: t.headingColor,
                  }}
                  onClick={() => scrollToSection(i)}
                  className="flex items-center gap-2 rounded-full px-4 py-2 font-sans text-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2"
                >
                  <span className="font-serif text-xs" style={{ color: t.mutedColor }}>
                    0{i + 1}
                  </span>
                  {cfg.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Scroll cue */}
        <motion.div
          style={{ opacity: cueO, borderTop: `1px solid ${t.dividerColor}` }}
          className="flex items-center gap-3 pt-4"
        >
          <motion.div
            animate={rm ? {} : { y: [0, 7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="h-8 w-px shrink-0 origin-top"
            style={{ background: `linear-gradient(to bottom, ${t.accentFg}70, transparent)` }}
          />
          <span className="font-sans text-xs uppercase tracking-widest" style={{ color: t.labelColor }}>
            Scroll to explore
          </span>
        </motion.div>
      </div>
      </GrainOverlay>
    </div>
  );
}
