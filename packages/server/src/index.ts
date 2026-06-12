import { ApplicationController } from './application.controller';
import { ApplicationModule } from './application.module';
import { createContainer } from './di/container';
import type { DeferredTaskRunner } from './background/deferred-task-runner';

export type CreateServerOptions = {
  deferredTaskRunner?: DeferredTaskRunner;
};

export function createServer(options?: CreateServerOptions) {
  const container = createContainer(options?.deferredTaskRunner);
  const module = container.get(ApplicationModule);
  const controller = container.get(ApplicationController);

  return {
    routes: controller.registerControllers(),
    startServer: () => module.start(),
    stopServer: () => module.stop()
  };
}

export type ApiRoutes = ReturnType<
  ApplicationController['registerControllers']
>;

export { createContainer } from './di/container';
export type { DeferredTaskRunner } from './background/deferred-task-runner';
export { ImmediateDeferredTaskRunner } from './background/deferred-task-runner';
export { AuthService } from './auth/auth.service';
export { AdvisorsService } from './advisors/advisors.service';
export { AdvisorsRepository } from './advisors/advisors.repository';
export { AdvisorRuntimeService } from './advisors/advisor-runtime.service';
export { AdvisorRuntimeVersionRepository } from './advisors/advisor-runtime.repository';
export { ModelConfigService } from './model-config/model-config.service';
export { ModelConfigRepository } from './model-config/model-config.repository';
export { ModelRateService } from './model-config/model-rate.service';
export { PromptSnapshotsRepository } from './prompt-cache/prompt-snapshots.repository';
export { DnaDigestsRepository } from './prompt-cache/dna-digests.repository';
export { CompiledSystemPromptBuilder } from './prompt-cache/compiled-system-prompt.builder';
export { DrizzleService } from './db/drizzle.service';
export * from './config/env';
export * from './common/http/http-exception';
export * from './common/utils/hono';
export * from './db/drizzle-schema';
