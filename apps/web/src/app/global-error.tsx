'use client';

import { RouteStateScreen, routeStateCopy } from '@/components/route-state';

import '../styles/globals.css';

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <RouteStateScreen copy={routeStateCopy.globalError} />
      </body>
    </html>
  );
}
