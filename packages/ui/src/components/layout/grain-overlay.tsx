'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';

interface GrainOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'medium' | 'strong';
}

const intensityOpacity: Record<
  NonNullable<GrainOverlayProps['intensity']>,
  string
> = {
  subtle: 'opacity-[0.18]',
  medium: 'opacity-[0.28]',
  strong: 'opacity-[0.40]'
};

export const GrainOverlay = React.forwardRef<HTMLDivElement, GrainOverlayProps>(
  ({ className, children, intensity = 'subtle', ...props }, ref) => {
    const id = React.useId();
    const filterId = `grain-${id.replace(/:/g, '')}`;

    return (
      <div
        ref={ref}
        className={cn('relative isolate overflow-hidden', className)}
        {...props}
      >
        {children}
        <svg
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply',
            intensityOpacity[intensity]
          )}
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id={filterId}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter={`url(#${filterId})`} />
        </svg>
      </div>
    );
  }
);
GrainOverlay.displayName = 'GrainOverlay';
