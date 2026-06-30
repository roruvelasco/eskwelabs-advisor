// ─── Types ────────────────────────────────────────────────────────────────────

export interface Advisor {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  status: string;
  activeRuntimeVersionId: string | null;
  availability?: {
    status: 'available' | 'unavailable';
    reasons?: string[];
  };
}

export type AdvisorCtaState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'unavailable' }
  | { status: 'available'; href: string };

// ─── Theme tokens ─────────────────────────────────────────────────────────────

export interface ThemeTokens {
  bg: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  cardBg: string;
  cardBorder: string;
  chipBorder: string;
  chipText: string;
  labelColor: string;
  dividerColor: string;
  accentFg: string;
  accentText: string;
  ctaBg: string;
  ctaHoverBg: string;
  navBg: string;
  navBorder: string;
  navText: string;
  navActiveText: string;
  navActiveBg: string;
  progressBar: string;
}
