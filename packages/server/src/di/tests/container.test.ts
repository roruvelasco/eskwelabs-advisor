import { describe, expect, test } from 'bun:test';

import { AdminController } from '../../admin/admin.controller';
import { AdvisorController } from '../../advisors/advisors.controller';
import { ApplicationController } from '../../application.controller';
import { ConversationController } from '../../conversations/conversations.controller';
import { MessageController } from '../../messages/messages.controller';
import { ModelConfigController } from '../../model-config/model-config.controller';
import { PromptCacheController } from '../../prompt-cache/prompt-cache.controller';
import { TelemetryController } from '../../telemetry/telemetry.controller';
import { UsageCounterController } from '../../usage-counters/usage-counters.controller';
import { UsersController } from '../../users/users.controller';
import { createContainer } from '../container';

describe('dependency container', () => {
  test('resolves application and domain controllers', () => {
    const container = createContainer();

    expect(container.get(ApplicationController)).toBeInstanceOf(
      ApplicationController
    );
    expect(container.get(AdminController)).toBeInstanceOf(AdminController);
    expect(container.get(AdvisorController)).toBeInstanceOf(AdvisorController);
    expect(container.get(ConversationController)).toBeInstanceOf(
      ConversationController
    );
    expect(container.get(MessageController)).toBeInstanceOf(MessageController);
    expect(container.get(ModelConfigController)).toBeInstanceOf(
      ModelConfigController
    );
    expect(container.get(PromptCacheController)).toBeInstanceOf(
      PromptCacheController
    );
    expect(container.get(TelemetryController)).toBeInstanceOf(TelemetryController);
    expect(container.get(UsageCounterController)).toBeInstanceOf(
      UsageCounterController
    );
    expect(container.get(UsersController)).toBeInstanceOf(UsersController);
  });
});
