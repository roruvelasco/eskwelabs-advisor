import { describe, expect, test } from 'bun:test';

import { usdAmount, usdGreaterThan, usdToMicros } from '../money';

describe('USD fixed precision helpers', () => {
  test('formats number inputs as six-decimal USD strings', () => {
    expect(usdAmount(0.1)).toBe('0.100000');
    expect(usdAmount(1)).toBe('1.000000');
    expect(usdAmount(-0.25)).toBe('-0.250000');
  });

  test('compares decimal sums without floating-point drift', () => {
    const sum = usdToMicros('0.1') + usdToMicros('0.2');

    expect(usdGreaterThan(sum, '0.3')).toBe(false);
    expect(usdGreaterThan(sum, '0.299999')).toBe(true);
  });

  test('rejects malformed USD inputs safely', () => {
    expect(() => usdToMicros(undefined as never)).toThrow(
      expect.objectContaining({ code: 'invalid_usd_amount' })
    );
    expect(() => usdToMicros('')).toThrow(
      expect.objectContaining({ code: 'invalid_usd_amount' })
    );
    expect(() => usdToMicros('not-a-number')).toThrow(
      expect.objectContaining({ code: 'invalid_usd_amount' })
    );
  });
});
