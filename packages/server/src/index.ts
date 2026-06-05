import { ApplicationController } from './application.controller';
import { ApplicationModule } from './application.module';
import { createContainer } from './di/container';

export function createServer() {
  const container = createContainer();
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
export { AuthService } from './auth/auth.service';
export * from './config/env';
export * from './common/http/http-exception';
export * from './common/utils/hono';
export * from './db/drizzle-schema';
