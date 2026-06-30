import type { ThemeTokens } from './types';

// ─── Advisor config ────────────────────────────────────────────────────────────

export const ADVISOR_CONFIG = {
  'data-dashboard': {
    index: 0,
    label: 'Dashboard',
    slug: 'dashboard',
    headline: 'Turn messy data into decision-ready dashboards.',
    body: 'This advisor helps you choose the right charts, structure Looker Studio pages, frame insights, and design dashboards that lead to decisions.',
    cta: 'Start Dashboard Advisor',
    stats: [
      { value: 6, suffix: '', label: 'chart types' },
      { value: 3, suffix: '', label: 'dashboard layers' },
      { value: 1, suffix: '', label: 'clear decision path' }
    ]
  },
  'ssot-memo': {
    index: 1,
    label: 'SSOT',
    slug: 'ssot',
    headline: 'Align every stakeholder around one source of truth.',
    body: 'This advisor turns scattered notes, interviews, and assumptions into a structured memo that clarifies definitions, decisions, and next steps.',
    cta: 'Draft SSOT Memo',
    stats: [
      { value: 4, suffix: '', label: 'memo sections' },
      { value: 12, suffix: '+', label: 'question prompts' },
      { value: 1, suffix: '', label: 'aligned document' }
    ]
  },
  'data-modeling': {
    index: 2,
    label: 'Modeling',
    slug: 'modeling',
    headline: 'Design the structure before the system scales.',
    body: 'This advisor helps you define clean tables, relationships, naming conventions, and analytics models so your data foundation is easier to query, maintain, and trust.',
    cta: 'Design Data Model',
    stats: [
      { value: 5, suffix: '+', label: 'entity types' },
      { value: 3, suffix: '', label: 'relationship layers' },
      { value: 1, suffix: '', label: 'clean schema' }
    ]
  }
} as const;

export type AdvisorId = keyof typeof ADVISOR_CONFIG;

export const ORDERED_IDS: AdvisorId[] = [
  'data-dashboard',
  'ssot-memo',
  'data-modeling'
];

// ─── Theme token objects ───────────────────────────────────────────────────────

// Light editorial theme — used by hero, SSOT, Modeling
export const LIGHT: ThemeTokens = {
  bg: '#f7f5f0',
  headingColor: '#1a4a35',
  bodyColor: 'rgba(45,106,79,0.65)',
  mutedColor: 'rgba(45,106,79,0.50)',
  cardBg: 'rgba(255,255,255,0.70)',
  cardBorder: 'rgba(45,106,79,0.10)',
  chipBorder: 'rgba(45,106,79,0.20)',
  chipText: 'rgba(26,74,53,0.60)',
  labelColor: 'rgba(45,106,79,0.50)',
  dividerColor: 'rgba(45,106,79,0.15)',
  accentFg: '#2d6a4f',
  accentText: '#1a4a35',
  ctaBg: '#2d6a4f',
  ctaHoverBg: '#1a4a35',
  navBg: 'rgba(247,245,240,0.92)',
  navBorder: 'rgba(45,106,79,0.10)',
  navText: 'rgba(26,74,53,0.60)',
  navActiveText: '#ffffff',
  navActiveBg: '#2d6a4f',
  progressBar: 'rgba(45,106,79,0.50)'
};

// Deep forest green theme — interpolated into during Dashboard scroll
export const GREEN: ThemeTokens = {
  bg: '#152f22',
  headingColor: '#f0ede6',
  bodyColor: 'rgba(196,218,207,0.75)',
  mutedColor: 'rgba(196,218,207,0.50)',
  cardBg: 'rgba(22,48,35,0.90)',
  cardBorder: 'rgba(196,218,207,0.12)',
  chipBorder: 'rgba(196,218,207,0.20)',
  chipText: 'rgba(240,237,230,0.60)',
  labelColor: 'rgba(196,218,207,0.50)',
  dividerColor: 'rgba(196,218,207,0.12)',
  accentFg: '#5aab82',
  accentText: '#c4dacd',
  ctaBg: '#2d6a4f',
  ctaHoverBg: '#3a8060',
  navBg: 'rgba(18,40,29,0.92)',
  navBorder: 'rgba(196,218,207,0.10)',
  navText: 'rgba(196,218,207,0.60)',
  navActiveText: '#f0ede6',
  navActiveBg: '#2d6a4f',
  progressBar: 'rgba(90,171,130,0.50)'
};
