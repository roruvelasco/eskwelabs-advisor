import { describe, expect, test } from 'bun:test';

import { AdvisorsSerializer } from '../advisors.serializer';
import { AdvisorsService } from '../advisors.service';

describe('advisors service', () => {
  test('lists active public advisors from the repository', async () => {
    const service = new AdvisorsService({
      list: async () => [
        {
          id: 'data-dashboard',
          name: 'Data Dashboard Advisor',
          description: 'Dashboard mentoring',
          promptDocId: 'private-doc-id',
          isActive: true,
          createdAt: new Date()
        }
      ]
    } as never);

    await expect(service.list()).resolves.toHaveLength(1);
  });
});

describe('advisors serializer', () => {
  test('excludes prompt Doc IDs from public advisor payloads', () => {
    const response = new AdvisorsSerializer().list([
      {
        id: 'data-dashboard',
        name: 'Data Dashboard Advisor',
        description: 'Dashboard mentoring',
        promptDocId: 'private-doc-id',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z')
      }
    ] as never);

    expect(JSON.stringify(response)).not.toContain('private-doc-id');
    expect(response.data[0]).toMatchObject({
      id: 'data-dashboard',
      name: 'Data Dashboard Advisor'
    });
  });
});
