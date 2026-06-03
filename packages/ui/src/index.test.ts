import { describe, expect, test } from 'bun:test';

import { cn } from './utils/cn';

describe('ui package', () => {
  test('merges class names', () => {
    expect(cn('px-2', false, 'px-4')).toBe('px-4');
  });
});
