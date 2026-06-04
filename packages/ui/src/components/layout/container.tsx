import * as React from 'react';
import { cn } from '../../utils/cn';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'main' | 'section' | 'article';
}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, as: Component = 'div', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('mx-auto w-full max-w-5xl px-6', className)}
        {...props}
      />
    );
  }
);
Container.displayName = 'Container';
