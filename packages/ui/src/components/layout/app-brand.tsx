import * as React from 'react';
import { cn } from '../../utils/cn';

interface AppBrandProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<AppBrandProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl'
};

export const AppBrand = React.forwardRef<HTMLSpanElement, AppBrandProps>(
  ({ size = 'md', className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('text-foreground font-serif', sizeMap[size], className)}
      {...props}
    >
      Eskwelabs Advisor
    </span>
  )
);
AppBrand.displayName = 'AppBrand';
