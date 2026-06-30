'use client';

import { RouteStateScreen, routeStateCopy } from '@/components/route-state';

export default function AuthError({ reset }: { reset: () => void }) {
  return <RouteStateScreen copy={routeStateCopy.authError} reset={reset} />;
}
