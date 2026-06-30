import { createHash } from 'node:crypto';

import type { RedisService } from '../cache/redis.service';
import type { DeferredTaskRunner } from '../background/deferred-task-runner';
import type { KnowledgeRepository } from './knowledge.repository';
import {
  contentTypesForMode,
  contextFromEvidence,
  determineMode,
  ruleEvidence,
  truncateEvidence,
  unitEvidence,
  type KnowledgeContext,
  type KnowledgeContextInput,
  type KnowledgeContextResolver,
  type KnowledgeEvidence
} from './knowledge-context.resolver';

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

const CONTEXT_CACHE_TTL_SECONDS = 300;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000;
const CIRCUIT_RESET_MS = 60 * 1000;

export class BoundedKnowledgeContextResolver implements KnowledgeContextResolver {
  private failureTimestamps: number[] = [];
  private circuitOpenUntil = 0;

  constructor(
    private inner: KnowledgeContextResolver,
    private knowledgeRepository: KnowledgeRepository,
    private redis: RedisService,
    private deferredTaskRunner: DeferredTaskRunner,
    private semanticBudgetMs: number
  ) {}

  async resolve(input: KnowledgeContextInput): Promise<KnowledgeContext> {
    const ctxKey = this.contextCacheKey(input);
    const cached = await this.redis.get<KnowledgeContext>(ctxKey);
    if (cached) return cached;

    if (this.isCircuitOpen()) {
      const ctx = await this.resolveLexical(input);
      this.redis.set(ctxKey, ctx, CONTEXT_CACHE_TTL_SECONDS).catch(() => {});
      return ctx;
    }

    try {
      const ctx = await this.resolveWithBudget(input);
      this.redis.set(ctxKey, ctx, CONTEXT_CACHE_TTL_SECONDS).catch(() => {});
      return ctx;
    } catch {
      this.recordFailure();
      this.deferredTaskRunner.run(async () => {
        try {
          await this.inner.resolve(input);
        } catch {
          // silent — background warm-up failure is non-critical
        }
      });
      const ctx = await this.resolveLexical(input);
      this.redis.set(ctxKey, ctx, CONTEXT_CACHE_TTL_SECONDS).catch(() => {});
      return ctx;
    }
  }

  private async resolveWithBudget(
    input: KnowledgeContextInput
  ): Promise<KnowledgeContext> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const budget = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('semantic_budget_exceeded')),
        this.semanticBudgetMs
      );
    });

    try {
      const result = await Promise.race([this.inner.resolve(input), budget]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async resolveLexical(
    input: KnowledgeContextInput
  ): Promise<KnowledgeContext> {
    if (
      input.answerMode === 'out_of_scope' ||
      input.answerMode === 'clarification_needed' ||
      input.answerMode === 'mentoring'
    ) {
      return contextFromEvidence('none', []);
    }

    const contentTypes = contentTypesForMode(input.answerMode);

    const [rules, units] = await Promise.all([
      this.knowledgeRepository.findPublishedRules({
        query: input.userContent,
        limit: 4
      }),
      this.knowledgeRepository.searchPublishedUnits({
        query: input.userContent,
        advisorId: input.advisorId,
        contentTypes,
        limit: 6
      })
    ]);

    const evidence: KnowledgeEvidence[] = [];
    evidence.push(...rules.map((rule, index) => ruleEvidence(rule, index)));
    evidence.push(
      ...units.map((unit) => unitEvidence(unit, evidence.length, 'lexical'))
    );

    const finalEvidence = truncateEvidence(evidence);
    const mode = determineMode(finalEvidence);

    return contextFromEvidence(mode, finalEvidence);
  }

  private isCircuitOpen(): boolean {
    const now = Date.now();
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => now - t < CIRCUIT_WINDOW_MS
    );

    if (now < this.circuitOpenUntil) return true;

    if (this.failureTimestamps.length >= CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitOpenUntil = now + CIRCUIT_RESET_MS;
      return true;
    }

    return false;
  }

  private recordFailure(): void {
    this.failureTimestamps.push(Date.now());
  }

  private contextCacheKey(input: KnowledgeContextInput): string {
    return `ktx:${input.advisorId}:${input.answerMode}:${sha256(input.userContent)}`;
  }
}
