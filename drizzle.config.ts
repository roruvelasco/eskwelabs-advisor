import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/server/src/db/drizzle-schema.ts',
  out: './packages/server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  }
});
