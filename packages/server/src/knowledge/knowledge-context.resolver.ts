import { createHash } from 'node:crypto';

import type { AnswerMode } from '../messages/query-policy.types';
import type { EmbeddingProvider } from './knowledge-providers';
import type { KnowledgeRepository } from './knowledge.repository';
import type { KnowledgeRule } from './knowledge-rules.schema';
import type { KnowledgeUnit } from './knowledge-units.schema';

export type KnowledgeEvidence = {
  unitId?: string;
  ruleId?: string;
  sourceRevision?: string;
  contentHash?: string;
  title: string;
  text: string;
  score?: string;
  strategy: 'structured_rule' | 'semantic' | 'none';
};

export type KnowledgeContext = {
  mode: 'none' | 'structured_rule' | 'semantic' | 'hybrid';
  evidence: KnowledgeEvidence[];
  contextText: string;
  contextHash: string;
};

export type KnowledgeContextInput = {
  advisorId: string;
  userContent: string;
  answerMode: AnswerMode;
};

export interface KnowledgeContextResolver {
  resolve(input: KnowledgeContextInput): Promise<KnowledgeContext>;
}

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

function contextFromEvidence(
  mode: KnowledgeContext['mode'],
  evidence: KnowledgeEvidence[]
): KnowledgeContext {
  const overrideWarning =
    mode === 'hybrid'
      ? 'IMPORTANT: If a structured rule and a semantic-knowledge unit contain conflicting information, the structured rule takes precedence. For non-conflicting information, use both sources together.\n\n'
      : '';

  const contextText =
    overrideWarning +
    evidence
      .map((item, index) =>
        [
          `<knowledge_evidence index="${index + 1}" strategy="${item.strategy}">`,
          `Title: ${item.title}`,
          item.sourceRevision ? `Source revision: ${item.sourceRevision}` : '',
          item.text,
          '</knowledge_evidence>'
        ]
          .filter(Boolean)
          .join('\n')
      )
      .join('\n\n');

  return {
    mode,
    evidence,
    contextText,
    contextHash: contextText ? sha256(contextText) : ''
  };
}

export class NoopKnowledgeContextResolver implements KnowledgeContextResolver {
  async resolve() {
    return contextFromEvidence('none', []);
  }
}

export class RepositoryKnowledgeContextResolver implements KnowledgeContextResolver {
  constructor(
    private knowledgeRepository: KnowledgeRepository,
    private embeddingProvider: EmbeddingProvider
  ) {}

  async resolve(input: KnowledgeContextInput) {
    if (
      input.answerMode === 'out_of_scope' ||
      input.answerMode === 'clarification_needed' ||
      input.answerMode === 'mentoring'
    ) {
      return contextFromEvidence('none', []);
    }

    const contentTypes = this.contentTypesForMode(input.answerMode);

    const rulesPromise = this.knowledgeRepository.findPublishedRules({
      query: input.userContent,
      limit: 4
    });

    const semanticPromise = (async () => {
      try {
        const embeddings = await this.embeddingProvider.embedTexts([
          input.userContent
        ]);
        const embeddingVector = embeddings[0]?.vector;
        if (!embeddingVector) return [];
        return await this.knowledgeRepository.searchUnitsByVector({
          embeddingVector,
          advisorId: input.advisorId,
          contentTypes,
          limit: 6
        });
      } catch {
        return [];
      }
    })();

    const [rules, units] = await Promise.all([rulesPromise, semanticPromise]);

    const ruleEvidence = rules.map((rule, index) =>
      this.ruleEvidence(rule, index)
    );
    const unitEvidence = units.map((unit, index) =>
      this.unitEvidence(unit, index)
    );
    const combined = [...ruleEvidence, ...unitEvidence];

    const finalEvidence: KnowledgeEvidence[] = [];
    let totalChars = 0;

    for (const item of combined) {
      if (finalEvidence.length >= 6) break;
      const evidenceOverhead =
        90 +
        item.title.length +
        (item.sourceRevision ? 20 + (item.sourceRevision ?? '').length : 0);
      const estimated = item.text.length + evidenceOverhead;
      if (totalChars + estimated <= 6000) {
        finalEvidence.push(item);
        totalChars += estimated;
      }
    }

    const mode = this.determineMode(finalEvidence);

    return contextFromEvidence(mode, finalEvidence);
  }

  private determineMode(
    evidence: KnowledgeEvidence[]
  ): KnowledgeContext['mode'] {
    if (evidence.length === 0) return 'none';
    const hasRules = evidence.some((e) => e.strategy === 'structured_rule');
    const hasUnits = evidence.some((e) => e.strategy === 'semantic');
    if (hasRules && hasUnits) return 'hybrid';
    if (hasRules) return 'structured_rule';
    return 'semantic';
  }

  private contentTypesForMode(answerMode: AnswerMode) {
    if (answerMode === 'factual_policy') {
      return ['policy', 'faq', 'ops_rule'];
    }

    if (answerMode === 'technical_guidance') {
      return ['course_material', 'mentor_guide', 'rubric', 'advisor_reference'];
    }

    return undefined;
  }

  private ruleEvidence(rule: KnowledgeRule, index: number): KnowledgeEvidence {
    return {
      ruleId: rule.id,
      title: rule.topic,
      text: rule.canonicalAnswer,
      score: String(1 - index / 10),
      strategy: 'structured_rule'
    };
  }

  private unitEvidence(unit: KnowledgeUnit, index: number): KnowledgeEvidence {
    return {
      unitId: unit.id,
      sourceRevision: unit.sourceRevision,
      contentHash: unit.contentHash,
      title: unit.sectionPath || unit.contentType,
      text: unit.summary ? `${unit.summary}\n\n${unit.text}` : unit.text,
      score: String(1 - index / 10),
      strategy: 'semantic'
    };
  }
}
