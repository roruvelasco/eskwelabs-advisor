import * as React from 'react';
import { cn } from '../../utils/cn';

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

const gapToClass: Record<Gap, string> = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
  8: 'gap-8',
  10: 'gap-10',
  12: 'gap-12'
};

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
}

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = 4, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col', gapToClass[gap], className)}
        {...props}
      />
    );
  }
);
Stack.displayName = 'Stack';
