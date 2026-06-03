import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';

import { QueryProvider } from '@/components/query-provider';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Eskwelabs Advisor',
  description: 'Internal AI advisor skeleton'
};

export default async function RootLayout({
  children
}: Readonly<{ children: ReactNode }>) {
  // Await headers() to force dynamic rendering so CSP nonces are injected per-request
  await headers();

  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
