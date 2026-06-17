'use client';

import { RouteStateScreen, routeStateCopy } from '@/components/route-state';

export default function RootError({ reset }: { reset: () => void }) {
  return <RouteStateScreen copy={routeStateCopy.rootError} reset={reset} />;
}
