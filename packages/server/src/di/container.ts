import { Container, InjectionToken } from '@needle-di/core';

import { AdminController } from '../admin/admin.controller';
import { AdminRepository } from '../admin/admin.repository';
import { AdminSerializer } from '../admin/admin.serializer';
import { AdminService } from '../admin/admin.service';
import { AdminOverviewUseCase } from '../admin/use-cases/admin-overview.use-case';
import {
  DeterministicDnaDigestSummarizer,
  DeterministicLlmProvider,
  GeminiLlmProvider,
  GoogleDocsClient,
  GoogleDocsGeminiDnaDigestGenerator,
  GroqDnaDigestSummarizer,
  GroqLlmProvider,
  RoutingLlmProvider,
  type DnaDigestSummarizer,
  type LlmProvider
} from '../adapters/advisor-adapters';
import { AdvisorController } from '../advisors/advisors.controller';
import { AdvisorRuntimeVersionRepository } from '../advisors/advisor-runtime.repository';
import { AdvisorRuntimeService } from '../advisors/advisor-runtime.service';
import { AdvisorsRepository } from '../advisors/advisors.repository';
import { AdvisorsSerializer } from '../advisors/advisors.serializer';
import { AdvisorsService } from '../advisors/advisors.service';
import { ApplicationController } from '../application.controller';
import { ApplicationModule } from '../application.module';
import { RedisService } from '../cache/redis.service';
import { ConversationTitleJobsRepository } from '../conversation-titles/conversation-title-jobs.repository';
import { ConversationTitleModelResolver } from '../conversation-titles/conversation-title-model-resolver';
import { ConversationTitleGenerator } from '../conversation-titles/conversation-title-generator';
import { ConversationTitleWorker } from '../conversation-titles/conversation-title-worker';
import { ConversationTitleJobsController } from '../conversation-titles/conversation-title-jobs.controller';
import { SuccessfulTurnPersistenceService } from '../conversation-titles/successful-turn-persistence.service';
import {
  DeferredTaskRunner,
  ImmediateDeferredTaskRunner
} from '../background/deferred-task-runner';
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
import { QueryPolicyService } from '../messages/query-policy.service';
import {
  ChatTurnUseCase,
  StreamChatTurnUseCase
} from '../messages/use-cases/chat-turn.use-case';
import { KnowledgeController } from '../knowledge/knowledge.controller';
import {
  NoopKnowledgeContextResolver,
  RepositoryKnowledgeContextResolver,
  type KnowledgeContextResolver
} from '../knowledge/knowledge-context.resolver';
import { KnowledgeIngestionService } from '../knowledge/knowledge-ingestion.service';
import { KnowledgeJobsController } from '../knowledge/knowledge-jobs.controller';
import {
  GroqEmbeddingProvider,
  PostgresKnowledgeIndexProvider,
  type EmbeddingProvider,
  type KnowledgeIndexProvider
} from '../knowledge/knowledge-providers';
import { KnowledgeRepository } from '../knowledge/knowledge.repository';
import { KnowledgeSerializer } from '../knowledge/knowledge.serializer';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { ModelConfigController } from '../model-config/model-config.controller';
import { ModelConfigRepository } from '../model-config/model-config.repository';
import { ModelRateService } from '../model-config/model-rate.service';
import { ModelConfigSerializer } from '../model-config/model-config.serializer';
import { ModelConfigService } from '../model-config/model-config.service';
import { PromptCacheController } from '../prompt-cache/prompt-cache.controller';
import { PromptCacheJobsController } from '../prompt-cache/prompt-cache-jobs.controller';
import { PromptCacheRepository } from '../prompt-cache/prompt-cache.repository';
import { PromptCacheSerializer } from '../prompt-cache/prompt-cache.serializer';
import { PromptCacheService } from '../prompt-cache/prompt-cache.service';
import {
  PromptContextRefreshUseCase,
  PromptRollbackUseCase
} from '../prompt-cache/use-cases/prompt-cache-workflow.use-case';
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
import { UsageLimitsController } from '../usage-limits/usage-limits.controller';
import { UsageLimitsRepository } from '../usage-limits/usage-limits.repository';
import { UsageLimitsSerializer } from '../usage-limits/usage-limits.serializer';
import { UsageLimitsService } from '../usage-limits/usage-limits.service';
import { AuthService } from '../auth/auth.service';
import { UsersController } from '../users/users.controller';
import { UsersRepository } from '../users/users.repository';
import { UsersSerializer } from '../users/users.serializer';
import { UsersService } from '../users/users.service';

export const SERVER_ENV = new InjectionToken<ServerEnv>('SERVER_ENV');
export const DNA_DIGEST_SUMMARIZER = new InjectionToken<DnaDigestSummarizer>(
  'DNA_DIGEST_SUMMARIZER'
);
export const USAGE_LIMITS_SERVICE = new InjectionToken<UsageLimitsService>(
  'USAGE_LIMITS_SERVICE'
);
export const LLM_PROVIDER = new InjectionToken<LlmProvider>('LLM_PROVIDER');
export const PROMPT_CONTEXT_LOADER = new InjectionToken<PromptContextLoader>(
  'PROMPT_CONTEXT_LOADER'
);
export const DEFERRED_TASK_RUNNER = new InjectionToken<DeferredTaskRunner>(
  'DEFERRED_TASK_RUNNER'
);
export const KNOWLEDGE_CONTEXT_RESOLVER =
  new InjectionToken<KnowledgeContextResolver>('KNOWLEDGE_CONTEXT_RESOLVER');
export const EMBEDDING_PROVIDER = new InjectionToken<EmbeddingProvider>(
  'EMBEDDING_PROVIDER'
);
export const KNOWLEDGE_INDEX_PROVIDER =
  new InjectionToken<KnowledgeIndexProvider>('KNOWLEDGE_INDEX_PROVIDER');

export function createContainer(deferredTaskRunner?: DeferredTaskRunner) {
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
        new RateLimitService(
          c.get(RedisService),
          c.get(USAGE_LIMITS_SERVICE),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: CostCapEnforcer,
      useFactory: (c) =>
        new CostCapEnforcer(
          c.get(UsageCountersService),
          c.get(USAGE_LIMITS_SERVICE),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: DNA_DIGEST_SUMMARIZER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        if (env.GROQ_API_KEY) {
          return new GroqDnaDigestSummarizer(env);
        }
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

        if (env.LLM_PROVIDER_MODE === 'deterministic') {
          providers.set('deterministic', new DeterministicLlmProvider());
          return new RoutingLlmProvider(providers);
        }

        if (env.GROQ_API_KEY) {
          providers.set('groq', new GroqLlmProvider(env));
        }

        if (env.GEMINI_API_KEY) {
          providers.set('gemini', new GeminiLlmProvider(env));
        }

        if (env.LLM_PROVIDER_MODE === 'auto' && providers.size === 0) {
          if (env.RUNTIME_PROFILE === 'production') {
            return new RoutingLlmProvider(providers);
          }
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
      provide: AdvisorRuntimeVersionRepository,
      useFactory: (c) =>
        new AdvisorRuntimeVersionRepository(c.get(DrizzleService))
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
      provide: KnowledgeRepository,
      useFactory: (c) => new KnowledgeRepository(c.get(DrizzleService))
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
      provide: UsageLimitsRepository,
      useFactory: (c) => new UsageLimitsRepository(c.get(DrizzleService))
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
      provide: KnowledgeSerializer,
      useFactory: () => new KnowledgeSerializer()
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
    .bind({
      provide: UsageLimitsSerializer,
      useFactory: () => new UsageLimitsSerializer()
    })
    .bind({ provide: UsersSerializer, useFactory: () => new UsersSerializer() })
    .bind({
      provide: QueryPolicyService,
      useFactory: (c) => new QueryPolicyService(c.get(EMBEDDING_PROVIDER))
    })
    .bind({
      provide: ModelRateService,
      useFactory: () => new ModelRateService()
    })
    .bind({
      provide: AdvisorsService,
      useFactory: (c) => new AdvisorsService(c.get(AdvisorsRepository))
    })
    .bind({
      provide: AdvisorRuntimeService,
      useFactory: (c) =>
        new AdvisorRuntimeService(
          c.get(AdvisorsRepository),
          c.get(AdvisorRuntimeVersionRepository),
          c.get(ModelConfigService),
          c.get(ModelRateService),
          c.get(PROMPT_CONTEXT_LOADER)
        )
    })
    .bind({
      provide: ConversationsService,
      useFactory: (c) =>
        new ConversationsService(
          c.get(ConversationsRepository),
          c.get(AdvisorRuntimeService),
          c.get(AdvisorsService)
        )
    })
    .bind({
      provide: ModelConfigService,
      useFactory: (c) => new ModelConfigService(c.get(ModelConfigRepository))
    })
    .bind({
      provide: KnowledgeIngestionService,
      useFactory: (c) =>
        new KnowledgeIngestionService(
          c.get(KnowledgeRepository),
          new GoogleDocsClient(c.get(SERVER_ENV)),
          c.get(TelemetryService),
          c.get(KNOWLEDGE_INDEX_PROVIDER)
        )
    })
    .bind({
      provide: KnowledgeService,
      useFactory: (c) =>
        new KnowledgeService(
          c.get(KnowledgeRepository),
          c.get(KnowledgeIngestionService),
          c.get(TelemetryService)
        )
    })
    .bind({
      provide: KNOWLEDGE_CONTEXT_RESOLVER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        if (env.RUNTIME_PROFILE === 'test') {
          return new NoopKnowledgeContextResolver();
        }
        return new RepositoryKnowledgeContextResolver(
          c.get(KnowledgeRepository),
          c.get(EMBEDDING_PROVIDER)
        );
      }
    })
    .bind({
      provide: EMBEDDING_PROVIDER,
      useFactory: (c) => {
        const env = c.get(SERVER_ENV);
        return new GroqEmbeddingProvider(env.GROQ_API_KEY, env.GROQ_BASE_URL);
      }
    })
    .bind({
      provide: KNOWLEDGE_INDEX_PROVIDER,
      useFactory: (c) => {
        return new PostgresKnowledgeIndexProvider(
          c.get(DrizzleService),
          c.get(EMBEDDING_PROVIDER)
        );
      }
    })
    .bind({
      provide: UsageCountersService,
      useFactory: (c) =>
        new UsageCountersService(c.get(UsageCountersRepository))
    })
    .bind({
      provide: USAGE_LIMITS_SERVICE,
      useFactory: (c) =>
        new UsageLimitsService(c.get(UsageLimitsRepository), c.get(SERVER_ENV))
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

        if (env.PROMPT_PROVIDER_MODE === 'deterministic') {
          return new DeterministicPromptContextService(
            c.get(CompiledSystemPromptBuilder)
          );
        }

        return new PromptContextService(
          c.get(PromptSnapshotsRepository),
          c.get(DnaDigestsRepository),
          c.get(RedisService),
          c.get(CompiledSystemPromptBuilder),
          c.get(TelemetryService)
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
      useFactory: (c) =>
        new AuthService(
          c.get(UsersService),
          c.get(RedisService),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: UsersController,
      useFactory: (c) =>
        new UsersController(c.get(UsersService), c.get(UsersSerializer))
    })
    .bind({
      provide: ConversationTitleJobsRepository,
      useFactory: (c) =>
        new ConversationTitleJobsRepository(c.get(DrizzleService))
    })
    .bind({
      provide: ConversationTitleModelResolver,
      useFactory: (c) => new ConversationTitleModelResolver(c.get(SERVER_ENV))
    })
    .bind({
      provide: ConversationTitleGenerator,
      useFactory: (c) => new ConversationTitleGenerator(c.get(LLM_PROVIDER))
    })
    .bind({
      provide: ConversationTitleWorker,
      useFactory: (c) =>
        new ConversationTitleWorker(
          c.get(ConversationTitleJobsRepository),
          c.get(MessagesRepository),
          c.get(ConversationTitleGenerator),
          c.get(ConversationsRepository),
          c.get(TelemetryService)
        )
    })
    .bind({
      provide: ConversationTitleJobsController,
      useFactory: (c) =>
        new ConversationTitleJobsController(
          c.get(ConversationTitleWorker),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: DEFERRED_TASK_RUNNER,
      useFactory: () => deferredTaskRunner ?? new ImmediateDeferredTaskRunner()
    })
    .bind({
      provide: SuccessfulTurnPersistenceService,
      useFactory: (c) =>
        new SuccessfulTurnPersistenceService(
          c.get(DrizzleService),
          c.get(MessagesRepository),
          c.get(ConversationTitleJobsRepository),
          c.get(ConversationTitleModelResolver)
        )
    })
    .bind({
      provide: MessagesService,
      useFactory: (c) =>
        new MessagesService(
          c.get(MessagesRepository),
          c.get(ConversationsService),
          c.get(ModelRateService),
          c.get(AdvisorRuntimeService),
          c.get(PROMPT_CONTEXT_LOADER),
          c.get(LLM_PROVIDER),
          c.get(CostCapEnforcer),
          c.get(UsageCountersService),
          c.get(TelemetryService),
          c.get(QueryPolicyService),
          c.get(SERVER_ENV),
          c.get(SuccessfulTurnPersistenceService),
          c.get(ConversationTitleWorker),
          c.get(DEFERRED_TASK_RUNNER),
          c.get(KNOWLEDGE_CONTEXT_RESOLVER),
          c.get(KnowledgeRepository)
        )
    })
    .bind({
      provide: ChatTurnUseCase,
      useFactory: (c) => new ChatTurnUseCase(c.get(MessagesService))
    })
    .bind({
      provide: StreamChatTurnUseCase,
      useFactory: (c) => new StreamChatTurnUseCase(c.get(MessagesService))
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
      provide: AdminOverviewUseCase,
      useFactory: (c) => new AdminOverviewUseCase(c.get(AdminService))
    })
    .bind({
      provide: PromptContextRefreshUseCase,
      useFactory: (c) =>
        new PromptContextRefreshUseCase(c.get(PromptCacheService))
    })
    .bind({
      provide: PromptRollbackUseCase,
      useFactory: (c) => new PromptRollbackUseCase(c.get(PromptCacheService))
    })
    .bind({
      provide: AdvisorController,
      useFactory: (c) =>
        new AdvisorController(
          c.get(AdvisorsService),
          c.get(AdvisorRuntimeService),
          c.get(AdvisorsSerializer)
        )
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
        new MessageController(
          c.get(MessagesService),
          c.get(MessagesSerializer),
          c.get(ChatTurnUseCase),
          c.get(StreamChatTurnUseCase)
        )
    })
    .bind({
      provide: ModelConfigController,
      useFactory: (c) =>
        new ModelConfigController(
          c.get(ModelConfigService),
          c.get(ModelConfigSerializer),
          c.get(TelemetryService)
        )
    })
    .bind({
      provide: PromptCacheController,
      useFactory: (c) =>
        new PromptCacheController(
          c.get(PromptCacheService),
          c.get(PromptCacheSerializer),
          c.get(PromptContextRefreshUseCase),
          c.get(PromptRollbackUseCase)
        )
    })
    .bind({
      provide: PromptCacheJobsController,
      useFactory: (c) =>
        new PromptCacheJobsController(
          c.get(PromptContextRefreshUseCase),
          c.get(SERVER_ENV)
        )
    })
    .bind({
      provide: KnowledgeController,
      useFactory: (c) =>
        new KnowledgeController(
          c.get(KnowledgeService),
          c.get(KnowledgeSerializer)
        )
    })
    .bind({
      provide: KnowledgeJobsController,
      useFactory: (c) =>
        new KnowledgeJobsController(c.get(KnowledgeService), c.get(SERVER_ENV))
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
      provide: UsageLimitsController,
      useFactory: (c) =>
        new UsageLimitsController(
          c.get(USAGE_LIMITS_SERVICE),
          c.get(UsageLimitsSerializer)
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
        new AdminController(c.get(AdminOverviewUseCase), c.get(AdminSerializer))
    })
    .bind({
      provide: ApplicationController,
      useFactory: (c) =>
        new ApplicationController(
          c.get(UsersService),
          c.get(RateLimitService),
          c.get(TelemetryService),
          c.get(SERVER_ENV),
          c.get(UsersController),
          c.get(AdvisorController),
          c.get(ConversationController),
          c.get(MessageController),
          c.get(ModelConfigController),
          c.get(PromptCacheController),
          c.get(UsageCounterController),
          c.get(UsageLimitsController),
          c.get(TelemetryController),
          c.get(AdminController),
          c.get(PromptCacheJobsController),
          c.get(ConversationTitleJobsController),
          c.get(KnowledgeController),
          c.get(KnowledgeJobsController)
        )
    })
    .bind({
      provide: ApplicationModule,
      useFactory: (c) => new ApplicationModule(c.get(DrizzleService))
    });

  return container;
}
