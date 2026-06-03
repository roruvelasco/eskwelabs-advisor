import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/server/src/db/drizzle-schema.ts',
  out: './packages/server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/eskwelabs_advisor'
  }
});
