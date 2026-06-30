import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

import { routeStateCopy } from './route-state';

const appDir = join(import.meta.dir, '..', 'app');

describe('route recovery states', () => {
  test('provides scoped recovery copy for all frontend route areas', () => {
    expect(routeStateCopy.rootError.primaryAction.label).toBe('Try again');
    expect(routeStateCopy.appError.secondaryAction?.href).toBe('/advisors');
    expect(routeStateCopy.authError.secondaryAction?.href).toBe('/login');
    expect(routeStateCopy.adminError.secondaryAction?.href).toBe('/admin');
    expect(routeStateCopy.globalError.primaryAction.href).toBe('/');
    expect(routeStateCopy.notFound.primaryAction.href).toBe('/advisors');
  });

  test('installs Next.js route convention files for graceful recovery', () => {
    const requiredFiles = [
      'error.tsx',
      'global-error.tsx',
      'loading.tsx',
      'not-found.tsx',
      '(app)/error.tsx',
      '(app)/loading.tsx',
      '(auth)/error.tsx',
      '(auth)/loading.tsx',
      'admin/error.tsx',
      'admin/loading.tsx'
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(appDir, file))).toBe(true);
    }
  });
});
