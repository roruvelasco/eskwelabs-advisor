import { describe, expect, test } from 'bun:test';
import { Context } from 'hono';
import { z } from 'zod';

import { HttpException } from '../http/http-exception';
import { parseJsonBody } from './validation.middleware';

const testSchema = z.object({ name: z.string() });

function makeContext(body: unknown) {
  return new Context(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
}

describe('parseJsonBody', () => {
  test('returns parsed data for valid body', async () => {
    const c = makeContext({ name: 'test' });
    const data = await parseJsonBody(c, testSchema);
    expect(data).toEqual({ name: 'test' });
  });

  test('throws validation_failed with issues for invalid body', async () => {
    const c = makeContext({ name: 123 });
    try {
      await parseJsonBody(c, testSchema);
      expect.unreachable();
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(HttpException);
      const err = e as HttpException;
      expect(err.code).toBe('validation_failed');
      expect(err.status).toBe(400);
      expect(err.safeDetails?.issues).toBeDefined();
      expect(
        (err.safeDetails!.issues as Array<unknown>).length
      ).toBeGreaterThan(0);
    }
  });

  test('throws validation_failed for malformed JSON', async () => {
    const c = new Context(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json'
      })
    );
    try {
      await parseJsonBody(c, testSchema);
      expect.unreachable();
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(HttpException);
      const err = e as HttpException;
      expect(err.code).toBe('validation_failed');
    }
  });
});
