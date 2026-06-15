import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));
export const serverEnvSchema = z
  .object({
    APP_ORIGIN: optionalUrl.default('http://localhost:3000'),
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
    SUPABASE_URL: optionalUrl.default(''),
    SUPABASE_ANON_KEY: z.string().optional().default(''),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
    UPSTASH_REDIS_REST_URL: optionalUrl.default(''),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
    GOOGLE_DOCS_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
    GOOGLE_DOCS_DNA_DOC_ID: z.string().optional().default(''),
    GOOGLE_REFRESH_TOKEN: z.string().optional().default(''),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    OPENAI_API_KEY: z.string().optional().default(''),
    ANTHROPIC_API_KEY: z.string().optional().default(''),
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().optional().default('gemini-2.5-flash-lite'),
    GROQ_API_KEY: z.string().optional().default(''),
    GROQ_BASE_URL: z
      .string()
      .optional()
      .default('https://api.groq.com/openai/v1'),
    PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(25),
    DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(100_000),
    DAILY_SPEND_LIMIT_USD: z.coerce.number().positive().default(10),
    DEFAULT_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .positive()
      .default(2_000),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    RUNTIME_PROFILE: z
      .enum(['production', 'demo', 'test'])
      .optional()
      .default('demo'),
    LLM_PROVIDER_MODE: z
      .enum(['auto', 'deterministic', 'gemini', 'groq'])
      .optional()
      .default('auto'),
    PROMPT_PROVIDER_MODE: z
      .enum(['auto', 'deterministic', 'snapshot'])
      .optional()
      .default('auto'),
    TITLE_GENERATION_PROVIDER: z.string().trim().min(1).optional(),
    TITLE_GENERATION_MODEL: z.string().trim().min(1).optional(),
    CRON_SECRET: z.string().trim().min(16).optional(),
    ACTOR_FORWARDING_SECRET: z
      .string()
      .min(16)
      .default('dev-actor-forwarding-secret-change-in-prod')
  })
  .refine(
    (data) => {
      const hasProvider = Boolean(data.TITLE_GENERATION_PROVIDER);
      const hasModel = Boolean(data.TITLE_GENERATION_MODEL);
      return hasProvider === hasModel;
    },
    {
      message:
        'TITLE_GENERATION_PROVIDER and TITLE_GENERATION_MODEL must be configured together or both absent'
    }
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv() {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}
