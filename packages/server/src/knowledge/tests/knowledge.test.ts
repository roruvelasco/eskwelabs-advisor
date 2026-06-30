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
        searchUnitsByVector: async () => []
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
      shouldSearch: true
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

  test('returns hybrid mode when both rules and semantic units resolve', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Refund policy',
            canonicalAnswer: 'Refunds require operations approval.'
          }
        ],
        searchUnitsByVector: async () => [
          {
            id: 'unit-1',
            sourceRevision: 'rev-1',
            contentHash: 'hash-1',
            sectionPath: 'Enrollment FAQ',
            contentType: 'faq',
            text: 'Enrollment opens quarterly.',
            summary: 'Enrollment FAQ summary.'
          }
        ]
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'What is the refund policy and how does enrollment work?',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('hybrid');
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0].strategy).toBe('structured_rule');
    expect(result.evidence[0].ruleId).toBe('rule-1');
    expect(result.evidence[1].strategy).toBe('semantic');
    expect(result.evidence[1].unitId).toBe('unit-1');
    expect(result.contextText).toContain(
      'IMPORTANT: If a structured rule and a semantic-knowledge unit'
    );
    expect(result.contextText).toContain(
      'the structured rule takes precedence'
    );
    expect(result.contextText).toContain('use both sources together');
    expect(result.contextHash.length).toBeGreaterThan(0);
  });

  test('skips evidence items that exceed the character budget', async () => {
    const longUnit = {
      id: 'unit-large',
      sourceRevision: 'rev-1',
      contentHash: 'hash-large',
      sectionPath: 'Dense policy document section',
      contentType: 'policy',
      text: 'X'.repeat(5500),
      summary: 'A'.repeat(1000)
    };
    const smallUnit = {
      id: 'unit-small',
      sourceRevision: 'rev-1',
      contentHash: 'hash-small',
      sectionPath: 'Short policy appendix',
      contentType: 'policy',
      text: 'Short policy note.',
      summary: 'Brief summary.'
    };

    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Refund policy',
            canonicalAnswer: 'Refunds require approval.'
          }
        ],
        searchUnitsByVector: async () => [longUnit, smallUnit]
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'refund',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('hybrid');
    const unitIds = result.evidence.map((e) => e.unitId).filter(Boolean);
    expect(unitIds).toEqual(['unit-small']);
    expect(result.evidence[0].ruleId).toBe('rule-1');
  });

  test('returns structured rules when embedding fails but rules exist', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Refund policy',
            canonicalAnswer: 'Refunds require operations approval.'
          }
        ],
        searchUnitsByVector: async () => []
      } as never,
      {
        embedTexts: async () => {
          throw new Error('API failure');
        }
      }
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'What is the refund policy?',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('structured_rule');
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].ruleId).toBe('rule-1');
    expect(result.evidence[0].strategy).toBe('structured_rule');
  });

  test('degrades to structured rules when semantic search returns no results', async () => {
    const resolver = new RepositoryKnowledgeContextResolver(
      {
        findPublishedRules: async () => [
          {
            id: 'rule-1',
            topic: 'Enrollment deadline',
            canonicalAnswer: 'Enrollment closes on March 15 every year.'
          }
        ],
        searchUnitsByVector: async () => []
      } as never,
      fakeEmbeddingProvider()
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'When is the enrollment deadline?',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('structured_rule');
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].strategy).toBe('structured_rule');
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

describe('bounded knowledge context resolver', () => {
  test('returns inner result when inner resolves within budget', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    const inner = {
      resolve: async () => ({
        mode: 'semantic' as const,
        evidence: [
          {
            unitId: 'u1',
            title: 'Test',
            text: 'text',
            strategy: 'semantic' as const
          }
        ],
        contextText: '<evidence>text</evidence>',
        contextHash: 'abc'
      })
    };

    const repo = {
      findPublishedRules: async () => [],
      searchPublishedUnits: async () => []
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const runner = { run: () => {} };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      5000
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'test query',
      answerMode: 'technical_guidance'
    });

    expect(result.mode).toBe('semantic');
    expect(result.evidence[0].strategy).toBe('semantic');
  });

  test('falls back to lexical search when inner exceeds budget', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    const inner = {
      resolve: async () =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('late')), 200)
        )
    };

    const repo = {
      findPublishedRules: async () => [
        {
          id: 'rule-1',
          topic: 'Refunds',
          canonicalAnswer: 'Refunds need approval.'
        }
      ],
      searchPublishedUnits: async () => [
        {
          id: 'unit-1',
          sourceRevision: 'r1',
          contentHash: 'h1',
          sectionPath: 'FAQ',
          contentType: 'faq',
          text: 'FAQ text.',
          summary: null
        }
      ]
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const runner = { run: () => {} };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      50
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'refund',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('hybrid');
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0].strategy).toBe('structured_rule');
    expect(result.evidence[1].strategy).toBe('lexical');
  });

  test('circuit breaker opens after consecutive failures', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    let innerCalls = 0;

    const inner = {
      resolve: async () => {
        innerCalls++;
        throw new Error('embedding failure');
      }
    };

    const repo = {
      findPublishedRules: async () => [],
      searchPublishedUnits: async () => []
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const runner = { run: () => {} };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      5000
    );

    for (let i = 0; i < 5; i++) {
      await resolver.resolve({
        advisorId: 'data-dashboard',
        userContent: 'test',
        answerMode: 'factual_policy'
      });
    }

    expect(innerCalls).toBe(3);
  });

  test('returns cached context on redis hit', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    let innerCalled = false;

    const inner = {
      resolve: async () => {
        innerCalled = true;
        return {
          mode: 'none' as const,
          evidence: [],
          contextText: '',
          contextHash: ''
        };
      }
    };

    const cached = {
      mode: 'structured_rule' as const,
      evidence: [
        {
          ruleId: 'r1',
          title: 'Cached',
          text: 'cached text',
          strategy: 'structured_rule' as const
        }
      ],
      contextText: 'cached',
      contextHash: 'cached-hash'
    };

    const redis = {
      get: async () => cached,
      set: async () => {}
    };

    const repo = {
      findPublishedRules: async () => [],
      searchPublishedUnits: async () => []
    };

    const runner = { run: () => {} };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      5000
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'test',
      answerMode: 'factual_policy'
    });

    expect(result.mode).toBe('structured_rule');
    expect(result.evidence[0].title).toBe('Cached');
    expect(innerCalled).toBe(false);
  });

  test('skips retrieval for non-search modes in lexical fallback', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    const inner = {
      resolve: async () => {
        throw new Error('fail');
      }
    };

    const repo = {
      findPublishedRules: async () => [],
      searchPublishedUnits: async () => []
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const runner = { run: () => {} };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      10
    );

    const result = await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'Help me think',
      answerMode: 'mentoring'
    });

    expect(result.mode).toBe('none');
    expect(result.evidence).toEqual([]);
  });

  test('deferred task runner schedules warm-up on fallback', async () => {
    const { BoundedKnowledgeContextResolver } =
      await import('../bounded-knowledge-context.resolver');

    const deferredTasks: Array<() => Promise<void>> = [];

    const inner = {
      resolve: async () => {
        throw new Error('fail');
      }
    };

    const repo = {
      findPublishedRules: async () => [],
      searchPublishedUnits: async () => []
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const runner = {
      run: (fn: () => Promise<void>) => {
        deferredTasks.push(fn);
      }
    };

    const resolver = new BoundedKnowledgeContextResolver(
      inner as never,
      repo as never,
      redis as never,
      runner as never,
      10
    );

    await resolver.resolve({
      advisorId: 'data-dashboard',
      userContent: 'test',
      answerMode: 'factual_policy'
    });

    expect(deferredTasks.length).toBe(1);
  });
});

describe('cached embedding provider coalescing', () => {
  test('coalesces concurrent requests for the same text', async () => {
    const { CachedEmbeddingProvider } =
      await import('../redis-embedding-cache.service');

    let innerCalls = 0;

    const inner = {
      embedTexts: async (texts: string[]) => {
        innerCalls++;
        return texts.map((t) => ({
          text: t,
          vector: [0.1, 0.2],
          hash: `h-${t}`
        }));
      }
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const cache = new CachedEmbeddingProvider(
      inner as never,
      redis as never,
      'groq',
      'test-model'
    );

    const results = await Promise.all([
      cache.getOrWarm('hello'),
      cache.getOrWarm('hello'),
      cache.getOrWarm('world')
    ]);

    expect(results).toHaveLength(3);
    expect(innerCalls).toBe(2);
    expect(results[0].text).toBe('hello');
    expect(results[1].text).toBe('hello');
    expect(results[2].text).toBe('world');
  });

  test('cleans up in-flight entries on failure', async () => {
    const { CachedEmbeddingProvider } =
      await import('../redis-embedding-cache.service');

    let innerCalls = 0;

    const inner = {
      embedTexts: async () => {
        innerCalls++;
        throw new Error('api down');
      }
    };

    const redis = {
      get: async () => null,
      set: async () => {}
    };

    const cache = new CachedEmbeddingProvider(
      inner as never,
      redis as never,
      'groq',
      'test-model'
    );

    await expect(cache.getOrWarm('fail-text')).rejects.toThrow('api down');
    expect(innerCalls).toBe(1);

    await expect(cache.getOrWarm('fail-text')).rejects.toThrow('api down');
    expect(innerCalls).toBe(2);
  });
});
