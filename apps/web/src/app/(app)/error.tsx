'use client';

import { RouteStateScreen, routeStateCopy } from '@/components/route-state';

export default function AppError({ reset }: { reset: () => void }) {
  return <RouteStateScreen copy={routeStateCopy.appError} reset={reset} />;
}
