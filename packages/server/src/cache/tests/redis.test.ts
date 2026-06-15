import { describe, expect, test } from 'bun:test';

import { RedisService } from '../redis.service';

const env = {
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  PROVIDER_TIMEOUT_MS: 60_000,
  DEFAULT_MAX_OUTPUT_TOKENS: 2000,
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.5-flash-lite',
  GROQ_API_KEY: '',
  GROQ_BASE_URL: '',
  GOOGLE_REFRESH_TOKEN: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  DATABASE_URL: 'postgresql://localhost:54322/postgres',
  APP_ORIGIN: 'http://localhost:3000',
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  GOOGLE_DOCS_SERVICE_ACCOUNT_JSON: '',
  GOOGLE_DOCS_DNA_DOC_ID: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  DAILY_MESSAGE_LIMIT: 25,
  DAILY_TOKEN_LIMIT: 100000,
  DAILY_SPEND_LIMIT_USD: 10,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_MAX_REQUESTS: 100,
  RUNTIME_PROFILE: 'test',
  LLM_PROVIDER_MODE: 'deterministic',
  PROMPT_PROVIDER_MODE: 'deterministic',
  ACTOR_FORWARDING_SECRET: 'test-secret-min-16-chars!!'
};

describe('RedisService memory fallback', () => {
  test('concurrent increments return unique increasing counts', async () => {
    const redis = new RedisService(env as never);
    const key = 'test:concurrent';
    const count = 50;

    const results = await Promise.all(
      Array.from({ length: count }, () => redis.incrWithTtl(key, 60))
    );

    expect(results).toHaveLength(count);
    expect(new Set(results).size).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(results).toContain(i + 1);
    }

    const final = await redis.incrWithTtl(key, 60);
    expect(final).toBe(count + 1);
  });

  test('TTL is not extended by a second increment inside the same window', async () => {
    const redis = new RedisService(env as never);
    const key = 'test:ttl-fixed';
    const ttlSeconds = 60;

    await redis.incrWithTtl(key, ttlSeconds);
    const expiresAfterFirst = redis['memory'].get(key)?.expiresAt;

    await redis.incrWithTtl(key, ttlSeconds);
    const expiresAfterSecond = redis['memory'].get(key)?.expiresAt;

    expect(expiresAfterSecond).toBe(expiresAfterFirst);
  });

  test('expired memory entries restart at count 1', async () => {
    const redis = new RedisService(env as never);
    const key = 'test:expired';
    const ttlSeconds = 0;

    await redis.incrWithTtl(key, ttlSeconds);
    await sleep(1);

    const count = await redis.incrWithTtl(key, ttlSeconds);
    expect(count).toBe(1);
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
