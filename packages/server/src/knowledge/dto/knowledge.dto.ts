import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { knowledgeRulesTable } from '../knowledge-rules.schema';
import { knowledgeSourcesTable } from '../knowledge-sources.schema';
import { knowledgeUnitsTable } from '../knowledge-units.schema';

export const knowledgeSourceDto = createSelectSchema(
  knowledgeSourcesTable
).pick({
  id: true,
  sourceType: true,
  externalId: true,
  title: true,
  url: true,
  owner: true,
  status: true,
  audience: true,
  advisorScope: true,
  contentType: true,
  revision: true,
  sourceHash: true,
  lastIngestedAt: true,
  createdAt: true,
  updatedAt: true
});

export const createKnowledgeSourceDto = createInsertSchema(
  knowledgeSourcesTable,
  {
    sourceType: (s) => s.min(1),
    externalId: (s) => s.min(1),
    title: (s) => s.min(1),
    advisorScope: (s) => s.min(1),
    contentType: (s) => s.min(1),
    audience: (s) => s.min(1)
  }
).pick({
  sourceType: true,
  externalId: true,
  title: true,
  url: true,
  owner: true,
  status: true,
  audience: true,
  advisorScope: true,
  contentType: true,
  metadata: true
});

export const knowledgeUnitDto = createSelectSchema(knowledgeUnitsTable).pick({
  id: true,
  sourceId: true,
  sourceRevision: true,
  sectionPath: true,
  contentType: true,
  advisorScope: true,
  audience: true,
  status: true,
  contentHash: true,
  effectiveFrom: true,
  effectiveTo: true,
  createdAt: true,
  updatedAt: true
});

export const knowledgeRuleDto = createSelectSchema(knowledgeRulesTable).pick({
  id: true,
  topic: true,
  canonicalAnswer: true,
  sourceUnitId: true,
  priority: true,
  status: true,
  effectiveFrom: true,
  effectiveTo: true,
  createdAt: true,
  updatedAt: true
});

export const knowledgeSearchDto = z.object({
  query: z.string().min(1),
  advisorId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(6)
});

export type CreateKnowledgeSourceDto = z.infer<typeof createKnowledgeSourceDto>;
