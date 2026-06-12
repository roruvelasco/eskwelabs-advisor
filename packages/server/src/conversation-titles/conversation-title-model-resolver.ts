import type { ServerEnv } from '../config/env';

export type ChatTurnModel = {
  provider: string;
  model: string;
};

export type TitleGenerationModel = {
  provider: string;
  model: string;
};

export class ConversationTitleModelResolver {
  constructor(private env: ServerEnv) {}

  resolve(chatTurnModel: ChatTurnModel): TitleGenerationModel {
    if (this.env.TITLE_GENERATION_PROVIDER && this.env.TITLE_GENERATION_MODEL) {
      return {
        provider: this.env.TITLE_GENERATION_PROVIDER,
        model: this.env.TITLE_GENERATION_MODEL
      };
    }

    return chatTurnModel;
  }
}
