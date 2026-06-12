import { DrizzleService } from '../db/drizzle.service';
import { MessagesRepository } from '../messages/messages.repository';
import type {
  MessageCreateInput,
  MessageRow
} from '../messages/messages.repository';
import { ConversationTitleJobsRepository } from './conversation-title-jobs.repository';
import {
  ConversationTitleModelResolver,
  type ChatTurnModel
} from './conversation-title-model-resolver';

export type PersistSuccessfulTurnInput = {
  userMessage: MessageCreateInput;
  assistantMessage: MessageCreateInput;
  titleGenerationModel: ChatTurnModel;
};

export type PersistSuccessfulTurnResult = {
  userMessage: MessageRow;
  assistantMessage: MessageRow;
  titleJobId?: string;
};

export class SuccessfulTurnPersistenceService {
  constructor(
    private drizzle: DrizzleService,
    private messagesRepository: MessagesRepository,
    private titleJobsRepository: ConversationTitleJobsRepository,
    private titleModelResolver: ConversationTitleModelResolver
  ) {}

  async persist(
    input: PersistSuccessfulTurnInput
  ): Promise<PersistSuccessfulTurnResult> {
    return this.drizzle.db.transaction(async (tx) => {
      const turn =
        await this.messagesRepository.createSuccessfulTurnInTransaction(
          tx,
          input.userMessage,
          input.assistantMessage
        );

      const resolvedTitleModel = this.titleModelResolver.resolve(
        input.titleGenerationModel
      );

      const titleJob = await this.titleJobsRepository.enqueueIfAbsent(tx, {
        conversationId: input.userMessage.conversationId,
        userMessageId: turn.userMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        provider: resolvedTitleModel.provider,
        model: resolvedTitleModel.model
      });

      return {
        ...turn,
        titleJobId: titleJob?.id
      };
    });
  }
}
