import { describe, expect, test } from 'bun:test';

import * as schema from '../drizzle-schema';

describe('db schema', () => {
  test('exports placeholder tables', () => {
    expect(Object.keys(schema).length).toBeGreaterThan(0);
  });
});
