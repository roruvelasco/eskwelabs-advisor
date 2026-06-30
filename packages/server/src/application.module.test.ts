import { describe, expect, test } from 'bun:test';

import { ApplicationModule } from './application.module';

describe('application module lifecycle', () => {
  test('stops long-lived database resources', async () => {
    let closeCalls = 0;
    const module = new ApplicationModule({
      close: async () => {
        closeCalls += 1;
      }
    });

    await module.stop();

    expect(closeCalls).toBe(1);
  });
});
