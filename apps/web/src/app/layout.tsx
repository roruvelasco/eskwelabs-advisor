import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { Fraunces, Geist } from 'next/font/google';

import { QueryProvider } from '@/components/query-provider';

import '../styles/globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap'
});

const frauncesSerif = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap'
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${frauncesSerif.variable}`}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
