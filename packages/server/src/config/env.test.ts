import { describe, expect, test } from 'bun:test';

import { serverEnvSchema } from './env';

describe('server env schema', () => {
  test('defaults to production runtime profile when omitted', () => {
    expect(serverEnvSchema.parse({}).RUNTIME_PROFILE).toBe('production');
  });

  test('allows explicit non-production runtime profiles', () => {
    expect(
      serverEnvSchema.parse({ RUNTIME_PROFILE: 'demo' }).RUNTIME_PROFILE
    ).toBe('demo');
    expect(
      serverEnvSchema.parse({ RUNTIME_PROFILE: 'test' }).RUNTIME_PROFILE
    ).toBe('test');
  });
});
