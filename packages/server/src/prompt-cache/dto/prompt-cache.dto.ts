import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { promptCacheTable } from '../prompt-cache.schema';

export const promptCacheDto = createSelectSchema(promptCacheTable).pick({
  key: true,
  valueHash: true,
  docRevision: true,
  dnaDigestVersion: true,
  lastGoodAt: true,
  expiresAt: true,
  updatedAt: true
});

export type PromptCacheDto = z.infer<typeof promptCacheDto>;
