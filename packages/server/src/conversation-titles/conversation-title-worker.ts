import type { ConversationsRepository } from '../conversations/conversations.repository';
import type { MessagesRepository } from '../messages/messages.repository';
import type { TelemetryService } from '../telemetry/telemetry.service';
import { ConversationTitleJobsRepository } from './conversation-title-jobs.repository';
import type { ConversationTitleJobRow } from './conversation-title-jobs.repository';
import {
  ConversationTitleGenerator,
  InvalidGeneratedConversationTitleError
} from './conversation-title-generator';
import {
  TITLE_GENERATION_DRAIN_CONCURRENCY,
  TITLE_GENERATION_DRAIN_LIMIT,
  TITLE_GENERATION_MAX_DRAIN_LIMIT,
  TITLE_GENERATION_RETRY_DELAYS_MS
} from './title-generation.constants';

export type ProcessConversationTitleJobResult =
  | { state: 'completed'; applied: boolean }
  | { state: 'retried' }
  | { state: 'failed' }
  | { state: 'not_claimed' };

export type DrainConversationTitleJobsResult = {
  recovered: { requeued: number; failed: number };
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  notClaimed: number;
};

export class ConversationTitleWorker {
  constructor(
    private jobsRepository: ConversationTitleJobsRepository,
    private messagesRepository: MessagesRepository,
    private titleGenerator: ConversationTitleGenerator,
    private conversationsRepository: ConversationsRepository,
    private telemetryService: TelemetryService
  ) {}

  async processJob(jobId: string): Promise<ProcessConversationTitleJobResult> {
    const job = await this.jobsRepository.claimById(jobId);

    if (!job) {
      return { state: 'not_claimed' };
    }

    return this.processClaimedJob(job);
  }

  async drain(
    requestedLimit?: number
  ): Promise<DrainConversationTitleJobsResult> {
    const recovered = await this.jobsRepository.recoverExpiredLeases();

    const limit = Math.min(
      Math.max(requestedLimit ?? TITLE_GENERATION_DRAIN_LIMIT, 1),
      TITLE_GENERATION_MAX_DRAIN_LIMIT
    );

    const jobs = await this.jobsRepository.claimBatch(limit);

    let completed = 0;
    let retried = 0;
    let failed = 0;
    let notClaimed = 0;

    for (let i = 0; i < jobs.length; i += TITLE_GENERATION_DRAIN_CONCURRENCY) {
      const chunk = jobs.slice(i, i + TITLE_GENERATION_DRAIN_CONCURRENCY);
      const results = await Promise.all(
        chunk.map((job) => this.processClaimedJob(job))
      );

      for (const result of results) {
        switch (result.state) {
          case 'completed':
            completed++;
            break;
          case 'retried':
            retried++;
            break;
          case 'failed':
            failed++;
            break;
          case 'not_claimed':
            notClaimed++;
            break;
        }
      }
    }

    const claimed = jobs.length;

    await this.telemetryService
      .record('conversation_title_drain_completed', '', 'info', {
        recovered: recovered.requeued + recovered.failed,
        requeued: recovered.requeued,
        expiredFailed: recovered.failed,
        claimed,
        completed,
        retried,
        failed,
        notClaimed
      })
      .catch(() => {});

    return {
      recovered,
      claimed,
      completed,
      retried,
      failed,
      notClaimed
    };
  }

  private async processClaimedJob(
    job: ConversationTitleJobRow
  ): Promise<ProcessConversationTitleJobResult> {
    try {
      const exchange =
        await this.messagesRepository.findSuccessfulExchangeByIds({
          conversationId: job.conversationId,
          userMessageId: job.userMessageId,
          assistantMessageId: job.assistantMessageId
        });

      if (!exchange) {
        await this.jobsRepository.markFailed(job.id, {
          error: 'Referenced messages missing or invalid'
        });
        await this.recordTelemetry(job, 'conversation_title_job_failed', {
          failureCategory: 'missing_exchange'
        });
        return { state: 'failed' };
      }

      const result = await this.titleGenerator.generate({
        provider: job.provider,
        model: job.model,
        firstUserMessage: exchange.userMessage.content,
        firstAssistantMessage: exchange.assistantMessage.content
      });

      const applied =
        await this.conversationsRepository.updateGeneratedTitleIfFallback(
          job.conversationId,
          result.title
        );

      await this.jobsRepository.markCompleted(job.id);
      await this.recordTelemetry(job, 'conversation_title_job_completed', {
        applied,
        latencyMs: result.latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostUsd: result.estimatedCostUsd
      });

      return { state: 'completed', applied };
    } catch (error) {
      const isInvalidTitle =
        error instanceof InvalidGeneratedConversationTitleError;
      const isTransient = !isInvalidTitle;

      if (isTransient && job.attempts < job.maxAttempts) {
        const delayIndex = Math.min(
          job.attempts - 1,
          TITLE_GENERATION_RETRY_DELAYS_MS.length - 1
        );
        const delayMs = TITLE_GENERATION_RETRY_DELAYS_MS[delayIndex];
        const runAfter = new Date(Date.now() + delayMs);

        await this.jobsRepository.markRetry(job.id, {
          runAfter,
          error: error instanceof Error ? error.message : String(error)
        });
        await this.recordTelemetry(
          job,
          'conversation_title_job_retry_scheduled',
          {
            attempts: job.attempts,
            maxAttempts: job.maxAttempts,
            runAfterMs: delayMs
          }
        );

        return { state: 'retried' };
      }

      await this.jobsRepository.markFailed(job.id, {
        error: error instanceof Error ? error.message : String(error)
      });
      await this.recordTelemetry(job, 'conversation_title_job_failed', {
        failureCategory: isInvalidTitle ? 'invalid_title' : 'generation_error'
      });

      return { state: 'failed' };
    }
  }

  private async recordTelemetry(
    job: {
      id: string;
      conversationId: string;
      provider: string;
      model: string;
    },
    eventName: string,
    payload: Record<string, unknown>
  ) {
    await this.telemetryService
      .record(eventName, '', 'info', {
        jobId: job.id,
        conversationId: job.conversationId,
        provider: job.provider,
        model: job.model,
        ...payload
      })
      .catch(() => {});
  }
}
