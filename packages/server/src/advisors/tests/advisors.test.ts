import { describe, expect, test } from 'bun:test';

import { AdvisorRuntimeService } from '../advisor-runtime.service';
import { AdvisorsSerializer } from '../advisors.serializer';
import { AdvisorsService } from '../advisors.service';
import { advisorRegistry, sharedDnaDocId } from '../advisor-registry';

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

  test('creates a new advisor and model config', async () => {
    const modelUpdates: unknown[] = [];
    const service = new AdvisorsService(
      {
        findById: async () => undefined,
        create: async (input: {
          id: string;
          name: string;
          description?: string;
          promptDocId?: string | null;
          isActive?: boolean;
          status?: string;
        }) => ({
          id: input.id,
          name: input.name,
          description: input.description ?? '',
          promptDocId: input.promptDocId ?? null,
          isActive: input.isActive ?? true,
          status: input.status ?? 'active',
          activeRuntimeVersionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } as never,
      {
        update: async (advisorId: string, input: unknown) => {
          modelUpdates.push({ advisorId, input });
        }
      } as never
    );

    const advisor = await service.create(
      {
        id: 'new-advisor',
        name: 'New Advisor',
        description: 'New mentoring scope',
        promptDocId: 'doc-1',
        modelConfig: {
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite'
        }
      },
      'admin-id'
    );

    expect(advisor.id).toBe('new-advisor');
    expect(modelUpdates).toEqual([
      {
        advisorId: 'new-advisor',
        input: {
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          updatedBy: 'admin-id'
        }
      }
    ]);
  });

  test('rejects duplicate advisor creation', async () => {
    const service = new AdvisorsService({
      findById: async () => ({ id: 'existing-advisor' }),
      create: async () => {
        throw new Error('should not create');
      }
    } as never);

    await expect(
      service.create(
        {
          id: 'existing-advisor',
          name: 'Existing Advisor'
        },
        'admin-id'
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  test('soft-disables advisor, model config, and runtime versions', async () => {
    const actions: string[] = [];
    const service = new AdvisorsService(
      {
        softDisable: async () => ({
          id: 'disabled-advisor',
          name: 'Disabled Advisor',
          description: '',
          promptDocId: null,
          isActive: false,
          status: 'disabled',
          activeRuntimeVersionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } as never,
      {
        setEnabled: async () => {
          actions.push('model-disabled');
        }
      } as never,
      {
        retireByAdvisorId: async () => {
          actions.push('runtime-retired');
        }
      } as never
    );

    await service.softDisable('disabled-advisor', 'admin-id');

    expect(actions.sort()).toEqual(['model-disabled', 'runtime-retired']);
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

  test('includes prompt Doc IDs in admin advisor payloads', () => {
    const response = new AdvisorsSerializer().adminSingle({
      id: 'data-dashboard',
      name: 'Data Dashboard Advisor',
      description: 'Dashboard mentoring',
      promptDocId: 'private-doc-id',
      isActive: true,
      status: 'active',
      activeRuntimeVersionId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      modelConfig: null,
      availability: { status: 'unavailable', reasons: ['not_published'] }
    });

    expect(response.data).toMatchObject({
      id: 'data-dashboard',
      promptDocId: 'private-doc-id',
      modelConfig: null,
      availability: { status: 'unavailable', reasons: ['not_published'] }
    });
  });
});

describe('advisor runtime publish', () => {
  const activeAdvisor = {
    id: 'data-dashboard',
    name: 'Data Dashboard Advisor',
    description: '',
    promptDocId: 'doc-1',
    isActive: true,
    status: 'active',
    activeRuntimeVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  test('publishes a runtime version when prerequisites exist', async () => {
    const service = new AdvisorRuntimeService(
      { findById: async () => activeAdvisor } as never,
      {
        publish: async () => ({
          id: 'runtime-version-id',
          advisorId: 'data-dashboard',
          promptSnapshotId: 'snapshot-id',
          dnaDigestId: 'digest-id',
          modelConfigAdvisorId: 'data-dashboard',
          versionNumber: 1,
          status: 'published',
          publishedAt: new Date(),
          publishedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } as never,
      {
        getForAdvisor: async () => ({
          advisorId: 'data-dashboard',
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          isEnabled: true
        })
      } as never,
      { assertRateConfigured: () => undefined } as never,
      {} as never,
      { findActive: async () => ({ id: 'snapshot-id' }) } as never,
      { findActive: async () => ({ id: 'digest-id' }) } as never
    );

    await expect(service.publish('data-dashboard')).resolves.toMatchObject({
      id: 'runtime-version-id',
      status: 'published'
    });
  });

  test('rejects publish when advisor has no prompt snapshot', async () => {
    const service = new AdvisorRuntimeService(
      { findById: async () => activeAdvisor } as never,
      {} as never,
      {
        getForAdvisor: async () => ({
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          isEnabled: true
        })
      } as never,
      { assertRateConfigured: () => undefined } as never,
      {} as never,
      { findActive: async () => undefined } as never,
      { findActive: async () => ({ id: 'digest-id' }) } as never
    );

    await expect(service.publish('data-dashboard')).rejects.toMatchObject({
      status: 422,
      code: 'advisor_prompt_snapshot_missing'
    });
  });

  test('rejects publish when model config is disabled', async () => {
    const service = new AdvisorRuntimeService(
      { findById: async () => activeAdvisor } as never,
      {} as never,
      {
        getForAdvisor: async () => ({
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          isEnabled: false
        })
      } as never,
      { assertRateConfigured: () => undefined } as never,
      {} as never,
      { findActive: async () => ({ id: 'snapshot-id' }) } as never,
      { findActive: async () => ({ id: 'digest-id' }) } as never
    );

    await expect(service.publish('data-dashboard')).rejects.toMatchObject({
      status: 422,
      code: 'advisor_model_disabled'
    });
  });
});

describe('advisor registry', () => {
  test('contains the three active doc-backed advisors', () => {
    expect(advisorRegistry.map((advisor) => advisor.id)).toEqual([
      'data-dashboard',
      'ssot-memo',
      'data-modeling'
    ]);
    expect(advisorRegistry.every((advisor) => advisor.promptDocId)).toBe(true);
    expect(sharedDnaDocId).toBe('1jQCF3lhyjAKbyEnK1fwDIalW05l8W5TJTZnaKZ9Tktw');
  });
});
