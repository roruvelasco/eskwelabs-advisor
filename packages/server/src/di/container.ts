import { Container, InjectionToken } from '@needle-di/core';

import { AdminController } from '../admin/admin.controller';
import { AdminRepository } from '../admin/admin.repository';
import { AdminSerializer } from '../admin/admin.serializer';
import { AdminService } from '../admin/admin.service';
import {
  DeterministicDnaDigestSummarizer,
  DeterministicLlmProvider,
  GeminiLlmProvider,
  GoogleDocsClient,
  GoogleDocsGeminiDnaDigestGenerator,
  GroqLlmProvider,
  RoutingLlmProvider,
  type DnaDigestSummarizer,
  type LlmProvider
} from '../adapters/advisor-adapters';
import { AdvisorController } from '../advisors/advisors.controller';
import { AdvisorsRepository } from '../advisors/advisors.repository';
import { AdvisorsSerializer } from '../advisors/advisors.serializer';
import { AdvisorsService } from '../advisors/advisors.service';
import { ApplicationController } from '../application.controller';
import { ApplicationModule } from '../application.module';
import { RedisService } from '../cache/redis.service';
import { getServerEnv, type ServerEnv } from '../config/env';
import { ConversationController } from '../conversations/conversations.controller';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { ConversationsSerializer } from '../conversations/conversations.serializer';
import { ConversationsService } from '../conversations/conversations.service';
import { DrizzleService } from '../db/drizzle.service';
import { MessageController } from '../messages/messages.controller';
import { MessagesRepository } from '../messages/messages.repository';
import { MessagesSerializer } from '../messages/messages.serializer';
import { MessagesService } from '../messages/messages.service';
import { ModelConfigController } from '../model-config/model-config.controller';
import { ModelConfigRepository } from '../model-config/model-config.repository';
import { ModelConfigSerializer } from '../model-config/model-config.serializer';
import { ModelConfigService } from '../model-config/model-config.service';
import { PromptCacheController } from '../prompt-cache/prompt-cache.controller';
import { PromptCacheRepository } from '../prompt-cache/prompt-cache.repository';
import { PromptCacheSerializer } from '../prompt-cache/prompt-cache.serializer';
import { PromptCacheService } from '../prompt-cache/prompt-cache.service';
import { CompiledSystemPromptBuilder } from '../prompt-cache/compiled-system-prompt.builder';
import { DnaDigestsRepository } from '../prompt-cache/dna-digests.repository';
import {
  DeterministicPromptContextService,
  PromptContextService,
  type PromptContextLoader
} from '../prompt-cache/prompt-context.service';
import { PromptIngestionService } from '../prompt-cache/prompt-ingestion.service';
import { PromptSnapshotsRepository } from '../prompt-cache/prompt-snapshots.repository';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { TelemetryController } from '../telemetry/telemetry.controller';
import { TelemetryRepository } from '../telemetry/telemetry.repository';
import { TelemetrySerializer } from '../telemetry/telemetry.serializer';
import { TelemetryService } from '../telemetry/telemetry.service';
import { CostCapEnforcer } from '../usage-counters/cost-cap.service';
import { UsageCounterController } from '../usage-counters/usage-counters.controller';
import { UsageCountersRepository } from '../usage-counters/usage-counters.repository';
import { UsageCountersSerializer } from '../usage-counters/usage-counters.serializer';
import { UsageCountersService } from '../usage-counters/usage-counters.service';
import { AuthService } from '../auth/auth.service';
import { UsersController } from '../users/users.controller';
import { UsersRepository } from '../users/users.repository';
import { UsersSerializer } from '../users/users.serializer';
import { UsersService } from '../users/users.service';

export const SERVER_ENV = new InjectionToken<ServerEnv>('SERVER_ENV');
export const DNA_DIGEST_SUMMARIZER = new InjectionToken<DnaDigestSummarizer>(
  'DNA_DIGEST_SUMMARIZER'
);
export const LLM_PROVIDER = new InjectionToken<LlmProvider>('LLM_PROVIDER');
export const PROMPT_CONTEXT_LOADER = new InjectionToken<PromptContextLoader>(
  'PROMPT_CONTEXT_LOADER'
);

export function createContainer() {
  const container = new Container();

  container
    .bind({ provide: SERVER_ENV, useFactory: () => getServerEnv() })
    .bind({
      provide: DrizzleService,
      useFactory: (c) => new DrizzleService(c.get(SERVER_ENV))
    })
    .bind({
      provide: RedisService,
      useFactory: (c) => new RedisService(c.get(SERVER_ENV))
    })
    .bind({
      provide: RateLimitService,
      useFactory: (c) =>
        new RateLimitService(c.get(RedisService), c.get(SERVER_ENV))
    })
    .bind({
      provide: CostCapEnforcer,
      useFactory: (c) =>
        new CostCapEnforcer(c.get(UsageCountersService), c.get(SERVER_ENV))
    })
    .bind({
      provide: DNA_DIGEST_SUMMARIZER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        if (env.GEMINI_API_KEY) {
          return new GoogleDocsGeminiDnaDigestGenerator(
            new GoogleDocsClient(env),
            env
          );
        }
        return new DeterministicDnaDigestSummarizer();
      }
    })
    .bind({
      provide: LLM_PROVIDER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        const providers = new Map<string, LlmProvider>();

        if (env.GROQ_API_KEY) {
          providers.set('groq', new GroqLlmProvider(env));
        }

        if (env.GEMINI_API_KEY) {
          providers.set('gemini', new GeminiLlmProvider(env));
        }

        if (providers.size === 0) {
          providers.set('deterministic', new DeterministicLlmProvider());
        }

        return new RoutingLlmProvider(providers);
      }
    })
    .bind({
      provide: AdminRepository,
      useFactory: (c) => new AdminRepository(c.get(DrizzleService))
    })
    .bind({
      provide: AdvisorsRepository,
      useFactory: (c) => new AdvisorsRepository(c.get(DrizzleService))
    })
    .bind({
      provide: ConversationsRepository,
      useFactory: (c) => new ConversationsRepository(c.get(DrizzleService))
    })
    .bind({
      provide: MessagesRepository,
      useFactory: (c) => new MessagesRepository(c.get(DrizzleService))
    })
    .bind({
      provide: ModelConfigRepository,
      useFactory: (c) => new ModelConfigRepository(c.get(DrizzleService))
    })
    .bind({
      provide: PromptCacheRepository,
      useFactory: (c) => new PromptCacheRepository(c.get(DrizzleService))
    })
    .bind({
      provide: PromptSnapshotsRepository,
      useFactory: (c) => new PromptSnapshotsRepository(c.get(DrizzleService))
    })
    .bind({
      provide: DnaDigestsRepository,
      useFactory: (c) => new DnaDigestsRepository(c.get(DrizzleService))
    })
    .bind({
      provide: TelemetryRepository,
      useFactory: (c) => new TelemetryRepository(c.get(DrizzleService))
    })
    .bind({
      provide: UsageCountersRepository,
      useFactory: (c) => new UsageCountersRepository(c.get(DrizzleService))
    })
    .bind({
      provide: UsersRepository,
      useFactory: (c) => new UsersRepository(c.get(DrizzleService))
    })
    .bind({ provide: AdminSerializer, useFactory: () => new AdminSerializer() })
    .bind({
      provide: AdvisorsSerializer,
      useFactory: () => new AdvisorsSerializer()
    })
    .bind({
      provide: ConversationsSerializer,
      useFactory: () => new ConversationsSerializer()
    })
    .bind({
      provide: MessagesSerializer,
      useFactory: () => new MessagesSerializer()
    })
    .bind({
      provide: ModelConfigSerializer,
      useFactory: () => new ModelConfigSerializer()
    })
    .bind({
      provide: PromptCacheSerializer,
      useFactory: () => new PromptCacheSerializer()
    })
    .bind({
      provide: CompiledSystemPromptBuilder,
      useFactory: () => new CompiledSystemPromptBuilder()
    })
    .bind({
      provide: TelemetrySerializer,
      useFactory: () => new TelemetrySerializer()
    })
    .bind({
      provide: UsageCountersSerializer,
      useFactory: () => new UsageCountersSerializer()
    })
    .bind({ provide: UsersSerializer, useFactory: () => new UsersSerializer() })
    .bind({
      provide: AdvisorsService,
      useFactory: (c) => new AdvisorsService(c.get(AdvisorsRepository))
    })
    .bind({
      provide: ConversationsService,
      useFactory: (c) =>
        new ConversationsService(
          c.get(ConversationsRepository),
          c.get(AdvisorsService),
          c.get(ModelConfigService)
        )
    })
    .bind({
      provide: ModelConfigService,
      useFactory: (c) => new ModelConfigService(c.get(ModelConfigRepository))
    })
    .bind({
      provide: UsageCountersService,
      useFactory: (c) =>
        new UsageCountersService(c.get(UsageCountersRepository))
    })
    .bind({
      provide: PromptCacheService,
      useFactory: (c) =>
        new PromptCacheService(
          c.get(PromptCacheRepository),
          c.get(RedisService),
          c.get(PromptIngestionService),
          c.get(PromptSnapshotsRepository),
          c.get(DnaDigestsRepository),
          c.get(TelemetryService)
        )
    })
    .bind({
      provide: PromptIngestionService,
      useFactory: (c) =>
        new PromptIngestionService(
          c.get(AdvisorsService),
          new GoogleDocsClient(c.get(SERVER_ENV)),
          c.get(DNA_DIGEST_SUMMARIZER),
          c.get(PromptSnapshotsRepository),
          c.get(DnaDigestsRepository),
          c.get(RedisService),
          c.get(SERVER_ENV),
          c.get(TelemetryService)
        )
    })
    .bind({
      provide: PROMPT_CONTEXT_LOADER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        if (env.GOOGLE_DOCS_SERVICE_ACCOUNT_JSON) {
          return new PromptContextService(
            c.get(PromptSnapshotsRepository),
            c.get(DnaDigestsRepository),
            c.get(RedisService),
            c.get(CompiledSystemPromptBuilder),
            c.get(TelemetryService)
          );
        }

        return new DeterministicPromptContextService(
          c.get(CompiledSystemPromptBuilder)
        );
      }
    })
    .bind({
      provide: TelemetryService,
      useFactory: (c) => new TelemetryService(c.get(TelemetryRepository))
    })
    .bind({
      provide: UsersService,
      useFactory: (c) => new UsersService(c.get(UsersRepository))
    })
    .bind({
      provide: AuthService,
      useFactory: (c) => new AuthService(c.get(UsersService))
    })
    .bind({
      provide: UsersController,
      useFactory: (c) =>
        new UsersController(c.get(UsersService), c.get(UsersSerializer))
    })
    .bind({
      provide: MessagesService,
      useFactory: (c) =>
        new MessagesService(
          c.get(MessagesRepository),
          c.get(ConversationsService),
          c.get(ModelConfigService),
          c.get(PROMPT_CONTEXT_LOADER),
          c.get(LLM_PROVIDER),
          c.get(CostCapEnforcer),
          c.get(UsageCountersService),
          c.get(TelemetryService),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: AdminService,
      useFactory: (c) =>
        new AdminService(
          c.get(AdminRepository),
          c.get(UsageCountersService),
          c.get(ModelConfigService),
          c.get(PromptCacheService),
          c.get(TelemetryService),
          c.get(UsersService)
        )
    })
    .bind({
      provide: AdvisorController,
      useFactory: (c) =>
        new AdvisorController(c.get(AdvisorsService), c.get(AdvisorsSerializer))
    })
    .bind({
      provide: ConversationController,
      useFactory: (c) =>
        new ConversationController(
          c.get(ConversationsService),
          c.get(ConversationsSerializer)
        )
    })
    .bind({
      provide: MessageController,
      useFactory: (c) =>
        new MessageController(c.get(MessagesService), c.get(MessagesSerializer))
    })
    .bind({
      provide: ModelConfigController,
      useFactory: (c) =>
        new ModelConfigController(
          c.get(ModelConfigService),
          c.get(ModelConfigSerializer)
        )
    })
    .bind({
      provide: PromptCacheController,
      useFactory: (c) =>
        new PromptCacheController(
          c.get(PromptCacheService),
          c.get(PromptCacheSerializer)
        )
    })
    .bind({
      provide: UsageCounterController,
      useFactory: (c) =>
        new UsageCounterController(
          c.get(UsageCountersService),
          c.get(UsageCountersSerializer)
        )
    })
    .bind({
      provide: TelemetryController,
      useFactory: (c) =>
        new TelemetryController(
          c.get(TelemetryService),
          c.get(TelemetrySerializer)
        )
    })
    .bind({
      provide: AdminController,
      useFactory: (c) =>
        new AdminController(c.get(AdminService), c.get(AdminSerializer))
    })
    .bind({
      provide: ApplicationController,
      useFactory: (c) =>
        new ApplicationController(
          c.get(UsersService),
          c.get(RateLimitService),
          c.get(TelemetryService),
          c.get(UsersController),
          c.get(AdvisorController),
          c.get(ConversationController),
          c.get(MessageController),
          c.get(ModelConfigController),
          c.get(PromptCacheController),
          c.get(UsageCounterController),
          c.get(TelemetryController),
          c.get(AdminController)
        )
    })
    .bind({
      provide: ApplicationModule,
      useFactory: () => new ApplicationModule()
    });

  return container;
}
