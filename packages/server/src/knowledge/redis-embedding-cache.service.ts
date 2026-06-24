import { createHash } from 'node:crypto';

import type { RedisService } from '../cache/redis.service';
import type { EmbeddingProvider, EmbeddingResult } from './knowledge-providers';

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

type CachedVector = {
  vector: number[];
  hash: string;
};

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export class CachedEmbeddingProvider implements EmbeddingProvider {
  private inFlight = new Map<string, Promise<EmbeddingResult>>();

  constructor(
    private inner: EmbeddingProvider,
    private redis: RedisService,
    private providerName: string,
    private model: string,
    private ttlSeconds = SEVEN_DAYS_SECONDS
  ) {}

  async embedTexts(
    texts: string[],
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = new Array(texts.length);
    const uncachedIndices: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      const key = this.cacheKey(texts[i]);
      const inFlight = this.inFlight.get(key);
      if (inFlight) {
        results[i] = await inFlight;
        continue;
      }

      const cached = await this.redis.get<CachedVector>(key);
      if (cached) {
        results[i] = {
          text: texts[i],
          vector: cached.vector,
          hash: cached.hash
        };
      } else {
        uncachedIndices.push(i);
      }
    }

    if (uncachedIndices.length === 0) return results;

    const uncachedTexts = uncachedIndices.map((i) => texts[i]);
    const fresh = await this.inner.embedTexts(uncachedTexts, options);

    const storePromises: Promise<void>[] = [];

    for (let j = 0; j < uncachedIndices.length; j++) {
      const idx = uncachedIndices[j];
      const result = fresh[j];
      if (!result) continue;
      results[idx] = result;

      const key = this.cacheKey(result.text);
      storePromises.push(
        this.redis
          .set(
            key,
            { vector: result.vector, hash: result.hash },
            this.ttlSeconds
          )
          .catch(() => {})
      );
    }

    return results;
  }

  async getOrWarm(
    text: string,
    options?: { signal?: AbortSignal; timeout?: number }
  ): Promise<EmbeddingResult> {
    const key = this.cacheKey(text);

    const cached = await this.redis.get<CachedVector>(key);
    if (cached) {
      return { text, vector: cached.vector, hash: cached.hash };
    }

    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight;

    const promise = this.inner.embedTexts([text], options).then((results) => {
      const result = results[0];
      if (!result) throw new Error('empty_embedding_result');
      return result;
    });

    this.inFlight.set(key, promise);

    try {
      const result = await promise;
      this.redis
        .set(key, { vector: result.vector, hash: result.hash }, this.ttlSeconds)
        .catch(() => {});
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private cacheKey(text: string): string {
    return `embed:${this.providerName}:${this.model}:${sha256(text)}`;
  }
}
