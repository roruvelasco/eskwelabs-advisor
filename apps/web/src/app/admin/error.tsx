'use client';

import { RouteStateScreen, routeStateCopy } from '@/components/route-state';

export default function AdminError({ reset }: { reset: () => void }) {
  return <RouteStateScreen copy={routeStateCopy.adminError} reset={reset} />;
}
