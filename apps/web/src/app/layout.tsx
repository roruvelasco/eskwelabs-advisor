import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/components/query-provider';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Eskwelabs Advisor',
  description: 'Internal AI advisor skeleton'
};

export default function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
