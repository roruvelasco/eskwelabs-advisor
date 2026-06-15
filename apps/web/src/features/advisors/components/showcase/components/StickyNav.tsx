'use client';

import { ADVISOR_CONFIG, ORDERED_IDS } from '../advisor-data';
import type { ThemeTokens } from '../types';

// ─── Sticky nav ────────────────────────────────────────────────────────────────

export function StickyNav({
  visible,
  activeIndex,
  sectionRefs,
  navTheme,
}: {
  visible: boolean;
  activeIndex: number;
  sectionRefs: React.MutableRefObject<(HTMLElement | null)[]>;
  navTheme: ThemeTokens;
}) {
  function scrollToSection(i: number) {
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b px-6 py-3 backdrop-blur-md transition-all duration-500 md:px-16"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transform: visible ? 'translateY(0)' : 'translateY(-10px)',
        backgroundColor: navTheme.navBg,
        borderColor: navTheme.navBorder,
      }}
      role="navigation"
      aria-label="Advisor sections"
      aria-hidden={!visible}
    >
      <span
        className="font-serif text-sm font-medium transition-colors duration-500"
        style={{ color: navTheme.headingColor }}
      >
        Eskwelabs Advisor
      </span>
      <div className="flex gap-1">
        {ORDERED_IDS.map((id, i) => {
          const cfg = ADVISOR_CONFIG[id];
          const isActive = activeIndex === i;
          return (
            <button
              key={id}
              onClick={() => scrollToSection(i)}
              tabIndex={visible ? 0 : -1}
              className="rounded-full px-3 py-1.5 font-sans text-xs uppercase tracking-widest transition-all duration-300 focus-visible:outline-none focus-visible:ring-2"
              style={
                isActive
                  ? { background: navTheme.navActiveBg, color: navTheme.navActiveText }
                  : { color: navTheme.navText }
              }
            >
              {cfg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
