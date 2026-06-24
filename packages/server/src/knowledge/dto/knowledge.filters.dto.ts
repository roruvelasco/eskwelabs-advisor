import { z } from 'zod';

export const knowledgeListFiltersDto = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.enum(['draft', 'published', 'retired', 'failed']).optional(),
  advisorScope: z.string().optional()
});

export type KnowledgeListFiltersDto = z.infer<typeof knowledgeListFiltersDto>;
