import { queryOptions } from '@tanstack/react-query';

import { listAdvisors } from './api';

export const advisorsQuery = queryOptions({
  queryKey: ['advisors'],
  queryFn: listAdvisors
});
