import { describe, expect, test } from 'bun:test';

import { PromptCacheJobsController } from '../prompt-cache-jobs.controller';
import type { ServerEnv } from '../../config/env';
import type { PromptContextRefreshUseCase } from '../use-cases/prompt-cache-workflow.use-case';

describe('prompt-cache cron controller', () => {
  const envWithSecret = { CRON_SECRET: 'test-cron-secret' } as ServerEnv;

  test('returns 500 when CRON_SECRET is not configured', async () => {
    const envWithoutSecret = {} as ServerEnv;
    const controller = new PromptCacheJobsController(
      {} as PromptContextRefreshUseCase,
      envWithoutSecret
    );

    const app = controller.routes();
    const res = await app.request('/internal/jobs/prompt-cache/refresh', {
      headers: { authorization: 'Bearer some-token' }
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Cron secret not configured');
  });

  test('returns 401 when authorization header is missing', async () => {
    const controller = new PromptCacheJobsController(
      {} as PromptContextRefreshUseCase,
      envWithSecret
    );

    const app = controller.routes();
    const res = await app.request('/internal/jobs/prompt-cache/refresh');

    expect(res.status).toBe(401);
  });

  test('returns 401 when authorization header does not use Bearer', async () => {
    const controller = new PromptCacheJobsController(
      {} as PromptContextRefreshUseCase,
      envWithSecret
    );

    const app = controller.routes();
    const res = await app.request('/internal/jobs/prompt-cache/refresh', {
      headers: { authorization: 'Basic dGVzdDoxMjM=' }
    });

    expect(res.status).toBe(401);
  });

  test('returns 401 when bearer token does not match CRON_SECRET', async () => {
    const controller = new PromptCacheJobsController(
      {} as PromptContextRefreshUseCase,
      envWithSecret
    );

    const app = controller.routes();
    const res = await app.request('/internal/jobs/prompt-cache/refresh', {
      headers: { authorization: 'Bearer wrong-token' }
    });

    expect(res.status).toBe(401);
  });

  test('calls refresh use case with source cron and returns result', async () => {
    let capturedSource: string | undefined;
    const useCase: PromptContextRefreshUseCase = {
      execute: async (actorId?: string, source?: string) => {
        capturedSource = source;
        return { status: 'refreshed', warmed: null };
      }
    } as unknown as PromptContextRefreshUseCase;

    const controller = new PromptCacheJobsController(useCase, envWithSecret);

    const app = controller.routes();
    const res = await app.request('/internal/jobs/prompt-cache/refresh', {
      headers: { authorization: 'Bearer test-cron-secret' }
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('refreshed');
    expect(capturedSource).toBe('cron');
  });
});
