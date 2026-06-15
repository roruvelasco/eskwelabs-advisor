// ─── Motion constants ──────────────────────────────────────────────────────────

export const rm =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// Standard spring-like cubic bezier for reveals
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
