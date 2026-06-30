'use client';

import * as React from 'react';
import { Streamdown } from 'streamdown';

import { cn } from '../../utils/cn';

export function Message({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex w-full', className)} {...props} />;
}

export function MessageContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        className
      )}
      {...props}
    />
  );
}

export function MessageResponse({
  children,
  className,
  isAnimating = false
}: {
  children: string;
  className?: string;
  isAnimating?: boolean;
}) {
  return (
    <div className={cn('ai-message-response', className)}>
      <Streamdown
        animated
        isAnimating={isAnimating}
        linkSafety={{ enabled: false }}
      >
        {children}
      </Streamdown>
    </div>
  );
}
