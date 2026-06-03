import { describe, expect, test } from 'bun:test';

import { createContainer } from '../../di/container';
import { AdvisorsService } from '../advisors.service';

describe('advisors service', () => {
  test('lists placeholder advisors', async () => {
    const advisors = await createContainer().get(AdvisorsService).list();
    expect(advisors.length).toBeGreaterThan(0);
  });
});
