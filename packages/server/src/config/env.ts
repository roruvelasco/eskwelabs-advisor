import { z } from 'zod';

const optionalUrl = z.string().url().optional().or(z.literal(''));
export const serverEnvSchema = z.object({
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
  GOOGLE_DOCS_PROMPT_DOC_ID: z.string().optional().default(''),
  GOOGLE_DOCS_DNA_DOC_ID: z.string().optional().default(''),
  GOOGLE_DOCS_API_KEY: z.string().optional().default(''),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().optional().default('gemini-2.0-flash'),
  DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(25),
  DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(100_000),
  DAILY_SPEND_LIMIT_USD: z.coerce.number().positive().default(10),
  DEFAULT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(2_000),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv() {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}
