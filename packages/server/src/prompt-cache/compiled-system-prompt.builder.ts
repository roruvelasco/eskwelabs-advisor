import { createHash } from 'node:crypto';

import { HttpException } from '../common/http/http-exception';

export type CompiledSystemPrompt = {
  text: string;
  hash: string;
};

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

export class CompiledSystemPromptBuilder {
  build(input: {
    dnaDigestText: string;
    advisorPromptText: string;
  }): CompiledSystemPrompt {
    const dnaDigestText = input.dnaDigestText.trim();
    const advisorPromptText = input.advisorPromptText.trim();

    if (!dnaDigestText || !advisorPromptText) {
      throw new HttpException(
        503,
        'Prompt context is incomplete',
        'prompt_context_incomplete'
      );
    }

    const text = [
      '<eskwelabs_dna_digest>',
      dnaDigestText,
      '</eskwelabs_dna_digest>',
      '',
      '<advisor_instructions>',
      advisorPromptText,
      '</advisor_instructions>'
    ].join('\n');

    return {
      text,
      hash: sha256(text)
    };
  }
}
