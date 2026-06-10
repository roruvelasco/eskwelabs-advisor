import {
  BarChart3,
  Database,
  GraduationCap,
  ScrollText,
  type LucideIcon
} from 'lucide-react';

export interface AdvisorMeta {
  icon: LucideIcon;
  focusArea: string;
}

export const ADVISOR_META: Record<string, AdvisorMeta> = {
  'data-dashboard': {
    icon: BarChart3,
    focusArea:
      'Build clear, decision-ready Looker Studio dashboards — layout, chart selection, and insight framing.'
  },
  'ssot-memo': {
    icon: ScrollText,
    focusArea:
      'Draft a structured single-source-of-truth memo and interview guide that aligns stakeholders on key data definitions.'
  },
  'data-modeling': {
    icon: Database,
    focusArea:
      'Design clean schemas and analytics models — table structure, relationships, and naming conventions for your dataset.'
  }
};

export const FALLBACK_META: AdvisorMeta = {
  icon: GraduationCap,
  focusArea:
    'Work through your EIF deliverable with guided, structured mentoring.'
};

export function getAdvisorMeta(id: string): AdvisorMeta {
  return ADVISOR_META[id] ?? FALLBACK_META;
}
