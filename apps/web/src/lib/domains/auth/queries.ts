import { queryOptions } from '@tanstack/react-query';

import { getBrowserSessionActor } from './session';

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => getBrowserSessionActor()
});
