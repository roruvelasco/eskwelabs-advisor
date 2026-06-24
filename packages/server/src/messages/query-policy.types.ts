export const ANSWER_MODES = [
  'mentoring',
  'technical_guidance',
  'factual_policy',
  'out_of_scope',
  'clarification_needed'
] as const;

export type AnswerMode = (typeof ANSWER_MODES)[number];

export type QueryPolicyResult = {
  answerMode: AnswerMode;
  requiresDnaSupport: boolean;
  answerContract: string;
};
