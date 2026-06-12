'use client';

import * as React from 'react';
import { toast, Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      duration={5000}
      closeButton={true}
      icons={{
        success: <span className="hidden" />,
        info: <span className="hidden" />,
        warning: <span className="hidden" />,
        error: <span className="hidden" />,
        loading: <span className="hidden" />
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          '--toast-icon-margin-start': '0px',
          '--toast-icon-margin-end': '0px',
          '--toast-svg-margin-start': '0px',
          '--toast-svg-margin-end': '0px',
          '--toast-button-margin-start': '0px',
          '--toast-button-margin-end': '0px',
          '--toast-close-button-start': 'auto',
          '--toast-close-button-end': '1rem',
          '--toast-close-button-transform': 'translateY(-50%)'
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: '!font-sans !text-sm !shadow-sm [&>[data-icon]]:!hidden',
          title: '!font-medium',
          success:
            '!bg-[var(--muted)] !text-[var(--success)] !border-[var(--success)]',
          error:
            '!bg-[var(--muted)] !text-[var(--destructive)] !border-[var(--destructive)]',
          warning:
            '!bg-[var(--muted)] !text-[var(--warning)] !border-[var(--warning)]',
          content: '!pr-8', // Add padding to the right of text so it doesn't overlap the close button
          closeButton:
            '!absolute !top-1/2 !bg-transparent !border-none !text-inherit opacity-70 hover:!opacity-100'
        }
      }}
      {...props}
    />
  );
};

export { toast, Toaster };
