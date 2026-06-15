'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { GrainOverlay } from '@eskwelabs-advisor/ui';
import { motion, useInView } from 'motion/react';

import { ADVISOR_CONFIG, LIGHT } from '../advisor-data';
import { EASE, rm } from '../motion-constants';
import type { Advisor, ThemeTokens } from '../types';
import type { AdvisorId } from '../advisor-data';
import { useLiveTheme } from '../hooks/use-live-theme';
import { DashboardVisual } from '../visuals/DashboardVisual';
import { ModelingVisual } from '../visuals/ModelingVisual';
import { SSOTVisual } from '../visuals/SSOTVisual';
import { fadeUp, StatCard } from './StatCard';

// ─── Advisor section ──────────────────────────────────────────────────────────

interface AdvisorSectionProps {
  advisorId: AdvisorId;
  advisor: Advisor | undefined;
  sectionRef: (el: HTMLElement | null) => void;
  isEven: boolean;
  // Optional image replacements — pass to replace abstract visuals
  imageSrc?: string;
  imageAlt?: string;
}

export function AdvisorSection({
  advisorId,
  advisor,
  sectionRef,
  isEven,
  imageSrc,
  imageAlt,
}: AdvisorSectionProps) {
  const cfg = ADVISOR_CONFIG[advisorId];
  const isDashboard = advisorId === 'data-dashboard';

  // Dual-purpose ref: drives both useInView and (for dashboard) useLiveTheme
  const innerRef = useRef<HTMLElement>(null);

  // once: false → re-animate every time section re-enters viewport
  const isInView = useInView(innerRef, { amount: 0.2, once: false });

  // Dashboard gets scroll-linked live theme; other sections use static LIGHT
  const dashTheme = useLiveTheme(innerRef);
  const theme: ThemeTokens = isDashboard ? dashTheme : LIGHT;

  // Merge the two refs
  function setRef(el: HTMLElement | null) {
    (innerRef as React.MutableRefObject<HTMLElement | null>).current = el;
    sectionRef(el);
  }

  const chatHref = advisor ? `/chat?advisor=${advisor.id}` : '#';
  const [ctaHovered, setCtaHovered] = useState(false);

  return (
    <GrainOverlay
      intensity="subtle"
      className="min-h-[100svh]"
      style={{ background: theme.bg }}
    >
      <section
        ref={setRef}
        id={cfg.slug}
        className="relative flex min-h-[100svh] flex-col justify-center px-6 py-20 md:px-16 md:py-24"
      >
      {/* Top border */}
      <div
        className="absolute left-0 right-0 top-0 h-px"
        style={{ background: theme.dividerColor }}
      />

      <div
        className={`flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-20 ${
          isEven ? '' : 'lg:flex-row-reverse'
        }`}
      >
        {/* Text side */}
        <div className="flex flex-1 flex-col justify-center lg:max-w-[52%]">
          {/* Label row */}
          <motion.div
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="mb-6 flex items-center gap-3"
          >
            <span
              className="font-sans text-[10px] uppercase tracking-widest"
              style={{ color: theme.labelColor }}
            >
              0{cfg.index + 1}
            </span>
            <div
              className="h-px flex-1"
              style={{ background: theme.dividerColor }}
            />
            <span
              className="rounded-full px-3 py-1 font-sans text-[10px] uppercase tracking-widest"
              style={{ border: `1px solid ${theme.chipBorder}`, color: theme.chipText }}
            >
              {cfg.label}
            </span>
          </motion.div>

          {/* API advisor name */}
          {advisor && (
            <motion.p
              variants={fadeUp}
              custom={0.06}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className="mb-2 font-sans text-xs uppercase tracking-widest"
              style={{ color: theme.mutedColor }}
            >
              {advisor.name}
            </motion.p>
          )}

          {/* Headline */}
          <motion.h2
            variants={fadeUp}
            custom={0.12}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="font-serif font-medium leading-[1.1] tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 3.25rem)', color: theme.headingColor }}
          >
            {cfg.headline}
          </motion.h2>

          {/* Body */}
          <motion.p
            variants={fadeUp}
            custom={0.22}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="mt-5 max-w-md font-sans text-base leading-relaxed"
            style={{ color: theme.bodyColor }}
          >
            {cfg.body}
          </motion.p>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-6">
            {cfg.stats.map((s, i) => (
              <StatCard
                key={s.label}
                value={s.value}
                suffix={s.suffix}
                label={s.label}
                delay={0.3 + 0.08 * i}
                triggered={isInView}
                theme={theme}
              />
            ))}
          </div>

          {/* CTA */}
          <motion.div
            variants={fadeUp}
            custom={0.52}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="mt-10"
          >
            <Link
              href={chatHref}
              onMouseEnter={() => setCtaHovered(true)}
              onMouseLeave={() => setCtaHovered(false)}
              className="group inline-flex items-center gap-3 rounded-full px-7 py-3.5 font-sans text-sm font-medium text-white shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]"
              style={{
                background: ctaHovered ? theme.ctaHoverBg : theme.ctaBg,
              }}
            >
              {cfg.cta}
              <span className="inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </motion.div>
        </div>

        {/* Visual side */}
        <motion.div
          initial={{ opacity: 0, y: rm ? 0 : 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: rm ? 0 : 30 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="w-full lg:flex-1"
        >
          {advisorId === 'data-dashboard' && (
            <DashboardVisual triggered={isInView} theme={theme} imageSrc={imageSrc} imageAlt={imageAlt} />
          )}
          {advisorId === 'ssot-memo' && (
            <SSOTVisual triggered={isInView} theme={theme} imageSrc={imageSrc} imageAlt={imageAlt} />
          )}
          {advisorId === 'data-modeling' && (
            <ModelingVisual triggered={isInView} theme={theme} imageSrc={imageSrc} imageAlt={imageAlt} />
          )}
        </motion.div>
      </div>
    </section>
    </GrainOverlay>
  );
}
