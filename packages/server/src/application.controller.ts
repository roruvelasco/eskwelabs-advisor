import { Hono } from 'hono';

import { AdminController } from './admin/admin.controller';
import { AdvisorController } from './advisors/advisors.controller';
import { MessageController } from './messages/messages.controller';
import { ModelConfigController } from './model-config/model-config.controller';
import { PromptCacheController } from './prompt-cache/prompt-cache.controller';
import { PromptCacheJobsController } from './prompt-cache/prompt-cache-jobs.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { UsageCounterController } from './usage-counters/usage-counters.controller';
import { UsageLimitsController } from './usage-limits/usage-limits.controller';
import { UsersController } from './users/users.controller';
import { ConversationController } from './conversations/conversations.controller';
import { ConversationTitleJobsController } from './conversation-titles/conversation-title-jobs.controller';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { KnowledgeJobsController } from './knowledge/knowledge-jobs.controller';
import { createAuthMiddleware } from './common/middleware/auth.middleware';
import { errorHandler } from './common/middleware/error.middleware';
import { createRateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { securityHeadersMiddleware } from './common/middleware/security.middleware';

import type { HonoEnv } from './common/utils/hono';
import type { RateLimitService } from './rate-limit/rate-limit.service';
import type { ServerEnv } from './config/env';
import type { TelemetryService } from './telemetry/telemetry.service';
import type { UsersService } from './users/users.service';

export class ApplicationController {
  private app = new Hono<HonoEnv>();

  constructor(
    private usersService: UsersService,
    private rateLimitService: RateLimitService,
    private telemetryService: TelemetryService,
    private serverEnv: Pick<ServerEnv, 'ACTOR_FORWARDING_SECRET'>,
    private usersController: UsersController,
    private advisorController: AdvisorController,
    private conversationController: ConversationController,
    private messageController: MessageController,
    private modelConfigController: ModelConfigController,
    private promptCacheController: PromptCacheController,
    private usageCounterController: UsageCounterController,
    private usageLimitsController: UsageLimitsController,
    private telemetryController: TelemetryController,
    private adminController: AdminController,
    private promptCacheJobsController: PromptCacheJobsController,
    private conversationTitleJobsController: ConversationTitleJobsController,
    private knowledgeController: KnowledgeController,
    private knowledgeJobsController: KnowledgeJobsController
  ) {}

  registerControllers() {
    this.app.onError(errorHandler);
    this.app.use('*', securityHeadersMiddleware);
    this.app.use('*', createAuthMiddleware(this.usersService, this.serverEnv));

    if (this.rateLimitService) {
      this.app.use(
        '/api/*',
        createRateLimitMiddleware(this.rateLimitService, this.telemetryService)
      );
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
      .route('/', this.usageLimitsController.routes())
      .route('/', this.telemetryController.routes())
      .route('/', this.adminController.routes())
      .route('/', this.promptCacheJobsController.routes())
      .route('/', this.conversationTitleJobsController.routes())
      .route('/', this.knowledgeController.routes())
      .route('/', this.knowledgeJobsController.routes());
  }
}
