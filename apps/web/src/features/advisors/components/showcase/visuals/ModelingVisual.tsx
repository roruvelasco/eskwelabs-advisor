'use client';

import { motion } from 'motion/react';

import { EASE } from '../motion-constants';
import type { ThemeTokens } from '../types';
import { VisualFrame } from './VisualFrame';

// ─── Data Modeling visual ─────────────────────────────────────────────────────

export function ModelingVisual({
  triggered,
  theme,
  imageSrc,
  imageAlt,
}: {
  triggered: boolean;
  theme: ThemeTokens;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const nodes = [
    { label: 'Users', x: 50, y: 15, primary: true },
    { label: 'Events', x: 18, y: 45 },
    { label: 'Metrics', x: 82, y: 45 },
    { label: 'Reports', x: 35, y: 80 },
    { label: 'Sessions', x: 65, y: 80 },
  ];
  const edges = [
    { x1: 50, y1: 22, x2: 21, y2: 40 },
    { x1: 50, y1: 22, x2: 79, y2: 40 },
    { x1: 21, y1: 50, x2: 37, y2: 75 },
    { x1: 79, y1: 50, x2: 63, y2: 75 },
    { x1: 37, y1: 82, x2: 63, y2: 82 },
  ];

  if (imageSrc) {
    return <VisualFrame imageSrc={imageSrc} imageAlt={imageAlt} theme={theme} />;
  }

  return (
    <VisualFrame theme={theme}>
      <div
        className="mb-3 font-sans text-[10px] uppercase tracking-widest"
        style={{ color: theme.labelColor }}
      >
        Entity Relationship Model
      </div>
      <div className="relative" style={{ paddingTop: '85%' }}>
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {edges.map((e, i) => (
            <motion.line
              key={i}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              style={{ stroke: theme.accentFg }}
              strokeWidth="0.6"
              strokeOpacity="0.4"
              strokeDasharray="2 1.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={triggered ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.55, delay: 0.3 + 0.1 * i }}
            />
          ))}
          {nodes.map((n, i) => (
            <motion.g
              key={n.label}
              initial={{ opacity: 0, scale: 0 }}
              animate={triggered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              transition={{ duration: 0.4, delay: 0.08 + 0.08 * i, ease: EASE }}
              style={{ transformOrigin: `${n.x}% ${n.y}%` }}
            >
              <circle
                cx={n.x} cy={n.y}
                r={n.primary ? 7 : 5.5}
                style={{
                  fill: n.primary ? theme.accentFg : theme.bg,
                  stroke: theme.accentFg,
                }}
                strokeWidth={n.primary ? 0 : 0.7}
                strokeOpacity="0.5"
              />
              <text
                x={n.x} y={n.y + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n.primary ? '3.5' : '3'}
                style={{ fill: n.primary ? '#f0ede6' : theme.headingColor }}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight="500"
              >
                {n.label}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>
    </VisualFrame>
  );
}
