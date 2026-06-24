import { createHash } from 'node:crypto';

import type { AnswerMode } from '../messages/query-policy.types';
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
  strategy: 'structured_rule' | 'lexical' | 'none';
};

export type KnowledgeContext = {
  mode: 'none' | 'structured_rule' | 'lexical' | 'hybrid';
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
  const contextText = evidence
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
  constructor(private knowledgeRepository: KnowledgeRepository) {}

  async resolve(input: KnowledgeContextInput) {
    if (
      input.answerMode === 'out_of_scope' ||
      input.answerMode === 'clarification_needed' ||
      input.answerMode === 'mentoring'
    ) {
      return contextFromEvidence('none', []);
    }

    const rules =
      input.answerMode === 'factual_policy'
        ? await this.knowledgeRepository.findPublishedRules({
            query: input.userContent,
            limit: 2
          })
        : [];

    if (rules.length > 0) {
      return contextFromEvidence(
        'structured_rule',
        rules.map((rule, index) => this.ruleEvidence(rule, index))
      );
    }

    const units = await this.knowledgeRepository.searchPublishedUnits({
      query: input.userContent,
      advisorId: input.advisorId,
      contentTypes: this.contentTypesForMode(input.answerMode),
      limit: 6
    });

    return contextFromEvidence(
      units.length > 0 ? 'lexical' : 'none',
      units.map((unit, index) => this.unitEvidence(unit, index))
    );
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
      strategy: 'lexical'
    };
  }
}
