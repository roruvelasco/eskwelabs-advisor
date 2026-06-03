import { Hono } from 'hono';

import { AdminController } from './admin/admin.controller';
import { AdvisorController } from './advisors/advisors.controller';
import { MessageController } from './messages/messages.controller';
import { ModelConfigController } from './model-config/model-config.controller';
import { PromptCacheController } from './prompt-cache/prompt-cache.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { UsageCounterController } from './usage-counters/usage-counters.controller';
import { UsersController } from './users/users.controller';
import { ConversationController } from './conversations/conversations.controller';
import { createAuthMiddleware } from './common/middleware/auth.middleware';
import { errorHandler } from './common/middleware/error.middleware';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { securityHeadersMiddleware } from './common/middleware/security.middleware';

import type { HonoEnv } from './common/utils/hono';
import type { ServerEnv } from './config/env';
import type { RateLimitService } from './rate-limit/rate-limit.service';

export class ApplicationController {
  private app = new Hono<HonoEnv>();

  constructor(
    private env: ServerEnv,
    private rateLimitService: RateLimitService,
    private usersController: UsersController,
    private advisorController: AdvisorController,
    private conversationController: ConversationController,
    private messageController: MessageController,
    private modelConfigController: ModelConfigController,
    private promptCacheController: PromptCacheController,
    private usageCounterController: UsageCounterController,
    private telemetryController: TelemetryController,
    private adminController: AdminController
  ) {}

  registerControllers() {
    this.app.onError(errorHandler);
    this.app.use('*', securityHeadersMiddleware);

    if (this.env) {
      this.app.use('*', createAuthMiddleware(this.env));
    }

    if (this.rateLimitService) {
      this.app.use('/api/*', createRateLimitMiddleware(this.rateLimitService));
    }

    return this.app
      .basePath('/api')
      .get('/', (c) => c.json({ status: 'ok', name: 'eskwelabs-advisor-api' }))
      .get('/healthz', (c) => c.json({ status: 'ok' }))
      .route('/', this.usersController.routes())
      .route('/', this.advisorController.routes())
      .route('/', this.conversationController.routes())
      .route('/', this.messageController.routes())
      .route('/', this.modelConfigController.routes())
      .route('/', this.promptCacheController.routes())
      .route('/', this.usageCounterController.routes())
      .route('/', this.telemetryController.routes())
      .route('/', this.adminController.routes());
  }
}
