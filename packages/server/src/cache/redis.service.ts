import { Redis } from '@upstash/redis';

import type { ServerEnv } from '../config/env';

const REDIS_SCAN_COUNT = 100;
const REDIS_DELETE_BATCH_SIZE = 100;

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
      for (const prefix of prefixes) {
        await this.delRedisKeysByPattern(`${prefix}*`);
      }
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

    const entry = this.memory.get(key);
    if (!entry || (entry.expiresAt && entry.expiresAt < Date.now())) {
      this.memory.set(key, {
        value: 1,
        expiresAt: Date.now() + ttlSeconds * 1000
      });
      return 1;
    }

    const count = (entry.value as number) + 1;
    this.memory.set(key, { value: count, expiresAt: entry.expiresAt });
    return count;
  }

  async incrWithTtlAtomic(key: string, ttlSeconds: number) {
    if (this.redis) {
      const result = await (
        this.redis as unknown as {
          eval: (
            script: string,
            keys: string[],
            args: string[]
          ) => Promise<number | string>;
        }
      ).eval(
        [
          'local count = redis.call("INCR", KEYS[1])',
          'if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end',
          'return count'
        ].join('\n'),
        [key],
        [String(ttlSeconds)]
      );
      return Number(result);
    }

    return this.incrWithTtl(key, ttlSeconds);
  }

  private async delRedisKeysByPattern(pattern: string) {
    if (!this.redis) return;

    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, {
        match: pattern,
        count: REDIS_SCAN_COUNT
      });
      cursor = nextCursor;

      for (let i = 0; i < keys.length; i += REDIS_DELETE_BATCH_SIZE) {
        await this.del(...keys.slice(i, i + REDIS_DELETE_BATCH_SIZE));
      }
    } while (cursor !== '0');
  }
}
