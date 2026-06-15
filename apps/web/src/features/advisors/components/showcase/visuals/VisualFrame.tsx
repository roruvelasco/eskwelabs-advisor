'use client';

import Image from 'next/image';

import type { ThemeTokens } from '../types';

// ─── VisualFrame — shared card shell (image or abstract visual) ───────────────

export interface VisualFrameProps {
  imageSrc?: string;
  imageAlt?: string;
  imageClassName?: string;
  caption?: string;
  children?: React.ReactNode;
  theme: ThemeTokens;
  className?: string;
}

export function VisualFrame({
  imageSrc,
  imageAlt,
  imageClassName,
  caption,
  children,
  theme,
  className = '',
}: VisualFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl shadow-sm ${className}`}
      style={{ border: `1px solid ${theme.cardBorder}`, background: theme.cardBg }}
    >
      {imageSrc ? (
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={imageSrc}
            alt={imageAlt ?? ''}
            fill
            className={`object-cover ${imageClassName ?? ''}`}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {caption && (
            <div
              className="absolute bottom-0 left-0 right-0 px-4 py-3 text-xs"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
                color: '#f0ede6',
              }}
            >
              {caption}
            </div>
          )}
        </div>
      ) : (
        <div className="p-5">{children}</div>
      )}
    </div>
  );
}
