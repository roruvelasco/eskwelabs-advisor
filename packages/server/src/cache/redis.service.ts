import { Redis } from '@upstash/redis';

import type { ServerEnv } from '../config/env';

export interface CacheEnvelope<T> {
  value: T;
  valueHash?: string;
  revision?: string;
  updatedAt: string;
  expiresAt?: string;
}

export class RedisService {
  private redis?: Redis;
  private memory = new Map<string, { value: unknown; expiresAt?: number }>();

  constructor(private env: ServerEnv) {
    if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
      this.redis = new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN
      });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      return this.redis.get<T>(key);
    }

    const item = this.memory.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number) {
    if (this.redis) {
      if (ttlSeconds) {
        await this.redis.set(key, value, { ex: ttlSeconds });
      } else {
        await this.redis.set(key, value);
      }
      return;
    }

    this.memory.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    });
  }

  async del(...keys: string[]) {
    if (keys.length === 0) return;
    if (this.redis) {
      await this.redis.del(...keys);
      return;
    }
    for (const key of keys) this.memory.delete(key);
  }

  async delByPrefix(...prefixes: string[]) {
    if (prefixes.length === 0) return;

    if (this.redis) {
      const keys = (
        await Promise.all(
          prefixes.map((prefix) => this.redis?.keys(`${prefix}*`) ?? [])
        )
      ).flat();
      await this.del(...keys);
      return;
    }

    for (const key of this.memory.keys()) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        this.memory.delete(key);
      }
    }
  }

  async incrWithTtl(key: string, ttlSeconds: number) {
    if (this.redis) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return count;
    }

    const current = await this.get<number>(key);
    const count = (current ?? 0) + 1;
    await this.set(key, count, ttlSeconds);
    return count;
  }
}
