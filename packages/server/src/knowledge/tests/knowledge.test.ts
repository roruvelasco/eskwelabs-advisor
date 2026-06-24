import { describe, expect, test } from 'bun:test';

import { RepositoryKnowledgeContextResolver } from '../knowledge-context.resolver';
import { KnowledgeIngestionService } from '../knowledge-ingestion.service';
import { KnowledgeService } from '../knowledge.service';
import type { AnswerMode } from '../../messages/query-policy.types';

function fakeEmbeddingProvider(vector: number[] = [0.1, 0.2, 0.3]) {
  return {
    embedTexts: async () => [{ text: '', vector, hash: 'hash-abc' }]
  };
}

describe('knowledge context resolver', () => {
  test('skips retrieval for mentoring turns', async () => {
    let searched = false;
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [],
        searchUnitsByVector: async () => {
          searched = true;
          return [];
        }
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'Help me think through my dashboard layout',
      answerMode: 'mentoring'
    });

    expect(result.mode).toBe('none');
    expect(result.evidence).toEqual([]);
    expect(searched).toBe(false);
  });

  test('prefers structured rules for factual policy turns', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Refund policy',
            canonicalAnswer: 'Refund requests must be escalated to operations.'
          }
        ],
        searchUnitsByVector: async () => {
          throw new Error('should not search when a rule matches');
        }
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'What is the refund policy?',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('structured_rule');
    expect(result.evidence).toEqual([
      expect.objectContaining({
        ruleId: 'rule-1',
        strategy: 'structured_rule'
      })
    ]);
    expect(result.contextText).toContain('Refund requests');
  });

  test('uses semantic vector search when no structured rule matches', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [],
        searchUnitsByVector: async (input: {
          embeddingVector: number[];
          advisorId?: string;
        }) => {
          expect(input.advisorId).toBe('data-dashboard');
          expect(input.embeddingVector).toEqual([0.1, 0.2, 0.3]);
          return [
            {
              id: 'unit-1',
              sourceRevision: 'rev-1',
              contentHash: 'hash-1',
              sectionPath: 'Dashboard rubric',
              contentType: 'rubric',
              text: 'Use clear KPI hierarchy.',
              summary: 'Dashboard rubric summary.'
            }
          ];
        }
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'How should I structure dashboard KPIs?',
      answerMode: 'technical_guidance'
    });

    expect(result.mode).toBe('semantic');
    expect(result.evidence[0]).toMatchObject({
      unitId: 'unit-1',
      strategy: 'semantic',
      sourceRevision: 'rev-1',
      contentHash: 'hash-1'
    });
  });

  const goldenFixtures: Array<{
    label: string;
    answerMode: AnswerMode;
    userContent: string;
    expectedMode: 'none' | 'structured_rule' | 'semantic';
    expectedStrategy?: 'structured_rule' | 'semantic' | 'none';
    shouldSearch: boolean;
  }> = [
    {
      label: 'mentoring: dashboard layout thinking',
      answerMode: 'mentoring',
      userContent: 'Help me think through my dashboard layout',
      expectedMode: 'none',
      shouldSearch: false
    },
    {
      label: 'clarification: vague request',
      answerMode: 'clarification_needed',
      userContent: 'What about data?',
      expectedMode: 'none',
      shouldSearch: false
    },
    {
      label: 'out of scope: unrelated question',
      answerMode: 'out_of_scope',
      userContent: 'How do I bake a cake?',
      expectedMode: 'none',
      shouldSearch: false
    },
    {
      label: 'factual policy: refund question',
      answerMode: 'factual_policy',
      userContent: 'What is the refund policy?',
      expectedMode: 'structured_rule',
      expectedStrategy: 'structured_rule',
      shouldSearch: false
    },
    {
      label: 'technical: KPI structuring',
      answerMode: 'technical_guidance',
      userContent: 'How should I structure dashboard KPIs?',
      expectedMode: 'semantic',
      expectedStrategy: 'semantic',
      shouldSearch: true
    }
  ];

  for (const fixture of goldenFixtures) {
    test(`golden: ${fixture.label}`, async () => {
      let searched = false;
      const resolver = new RepositoryKnowledgeContextResolver(
        {
          findPublishedRules: async () =>
            fixture.answerMode === 'factual_policy'
              ? [
                  {
                    id: 'rule-1',
                    topic: 'Refund policy',
                    canonicalAnswer:
                      'Refund requests must be escalated to operations.'
                  }
                ]
              : [],
          searchUnitsByVector: async () => {
            searched = true;
            return fixture.answerMode === 'technical_guidance'
              ? [
                  {
                    id: 'unit-1',
                    sourceRevision: 'rev-1',
                    contentHash: 'hash-1',
                    sectionPath: 'Dashboard rubric',
                    contentType: 'rubric',
                    text: 'Use clear KPI hierarchy.',
                    summary: 'Dashboard rubric summary.'
                  }
                ]
              : [];
          }
        } as never,
        fakeEmbeddingProvider()
      );

      const result = await resolver.resolve({
        advisorId: 'data-dashboard',
        userContent: fixture.userContent,
        answerMode: fixture.answerMode
      });

      expect(result.mode).toBe(fixture.expectedMode);
      expect(searched).toBe(fixture.shouldSearch);

      if (fixture.expectedStrategy) {
        expect(result.evidence.length).toBeGreaterThan(0);
        expect(result.evidence[0].strategy).toBe(fixture.expectedStrategy);
        expect(result.contextText.length).toBeGreaterThan(0);
        expect(result.contextHash.length).toBeGreaterThan(0);
      } else {
        expect(result.evidence).toEqual([]);
        expect(result.contextText).toBe('');
        expect(result.contextHash).toBe('');
      }
    });
  }

  test('golden: context text formats evidence XML correctly', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Enrollment deadline',
            canonicalAnswer: 'Enrollment closes on March 15 every year.'
          }
        ],
        searchUnitsByVector: async () => {
          throw new Error('should not search when rule matches');
        }
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'When is the enrollment deadline?',
      answerMode: 'factual_policy'
    });

    expect(result.contextText).toContain('<knowledge_evidence');
    expect(result.contextText).toContain('index="1"');
    expect(result.contextText).toContain('strategy="structured_rule"');
    expect(result.contextText).toContain('Enrollment deadline');
    expect(result.contextText).toContain('Enrollment closes on March 15');
  });

  test('golden: embedding failure returns empty context', async () => {
    let searched = false;
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [],
        searchUnitsByVector: async () => {
          searched = true;
          return [];
        }
      } as never,
      {
        embedTexts: async () => {
          throw new Error('API failure');
        }
      }
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'What are the KPIs?',
      answerMode: 'technical_guidance'
    });

    expect(result.mode).toBe('none');
    expect(result.evidence).toEqual([]);
    expect(searched).toBe(false);
  });

  test('golden: empty user content still resolves correctly', async () => {
    let searched = false;
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [],
        searchUnitsByVector: async () => {
          searched = true;
          return [];
        }
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: '',
      answerMode: 'technical_guidance'
    });

    expect(result.mode).toBe('none');
    expect(result.evidence).toEqual([]);
    expect(searched).toBe(true);
  });
});

describe('knowledge ingestion service', () => {
  test('ingests a Google Doc into source-backed units', async () => {
    const replaced: unknown[] = [];
    const service = new KnowledgeIngestionService(
      {
        findSourceById: async () => ({
          id: 'source-1',
          sourceType: 'google_doc',
          externalId: 'doc-1',
          title: 'Policies',
          contentType: 'policy',
          advisorScope: 'global',
          audience: 'advisor',
          revision: null,
          sourceHash: null
        }),
        replaceUnitsForSourceRevision: async (input: unknown) => {
          replaced.push(input);
          return [
            {
              id: 'unit-1',
              sourceId: 'source-1'
            }
          ];
        },
        updateSourceIngestion: async (input: unknown) => ({
          id: 'source-1',
          ...(input as Record<string, unknown>)
        })
      } as never,
      {
        fetchDocument: async () => ({
          revision: 'rev-1',
          text: 'Refund Policy\n\nRefunds require operations approval.\n\nCertification\n\nCertificates require completion.'
        })
      } as never
    );

    const result = await service.ingestSource('source-1');

    expect(result.source).toMatchObject({
      sourceId: 'source-1',
      revision: 'rev-1',
      status: 'published'
    });
    const replacement = replaced[0] as {
      sourceId: string;
      sourceRevision: string;
      units: Array<{
        contentType: string;
        advisorScope: string;
        status: string;
      }>;
    };
    expect(replacement.sourceId).toBe('source-1');
    expect(replacement.sourceRevision).toBe('rev-1');
    expect(replacement.units.length).toBeGreaterThan(0);
    expect(replacement.units[0]).toMatchObject({
      contentType: 'policy',
      advisorScope: 'global',
      status: 'published'
    });
  });
});

describe('knowledge service', () => {
  test('reports skipped refresh when ingestion is not configured', async () => {
    const service = new KnowledgeService({} as never);

    await expect(service.refreshSource('source-1')).resolves.toEqual({
      status: 'skipped',
      code: 'knowledge_ingestion_not_configured'
    });
  });
});
