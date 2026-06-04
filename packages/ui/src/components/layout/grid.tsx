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

type BreakpointKey = 'base' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const gridColClasses: Record<string, string> = {
  'base-1': 'grid-cols-1',
  'base-2': 'grid-cols-2',
  'base-3': 'grid-cols-3',
  'base-4': 'grid-cols-4',
  'xs-1': 'xs:grid-cols-1',
  'xs-2': 'xs:grid-cols-2',
  'xs-3': 'xs:grid-cols-3',
  'xs-4': 'xs:grid-cols-4',
  'sm-1': 'sm:grid-cols-1',
  'sm-2': 'sm:grid-cols-2',
  'sm-3': 'sm:grid-cols-3',
  'sm-4': 'sm:grid-cols-4',
  'md-1': 'md:grid-cols-1',
  'md-2': 'md:grid-cols-2',
  'md-3': 'md:grid-cols-3',
  'md-4': 'md:grid-cols-4',
  'lg-1': 'lg:grid-cols-1',
  'lg-2': 'lg:grid-cols-2',
  'lg-3': 'lg:grid-cols-3',
  'lg-4': 'lg:grid-cols-4',
  'xl-1': 'xl:grid-cols-1',
  'xl-2': 'xl:grid-cols-2',
  'xl-3': 'xl:grid-cols-3',
  'xl-4': 'xl:grid-cols-4'
};

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Gap;
  cols?: Partial<Record<BreakpointKey, 1 | 2 | 3 | 4>>;
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, gap = 4, cols, ...props }, ref) => {
    const colClasses = cols
      ? Object.entries(cols).map(
          ([bp, n]) => gridColClasses[`${bp}-${n}`] ?? ''
        )
      : [];

    return (
      <div
        ref={ref}
        className={cn('grid', gapToClass[gap], ...colClasses, className)}
        {...props}
      />
    );
  }
);
Grid.displayName = 'Grid';
