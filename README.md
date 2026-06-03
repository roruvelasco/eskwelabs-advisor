# Eskwelabs Advisor

Skeleton monorepo for a Next.js, Hono, TypeScript, Supabase-oriented internal AI advisor platform.

This repo intentionally contains architecture stubs rather than product-complete behavior. The folders mirror the backend and frontend hierarchy that future implementation work should follow.

## Commands

- `bun install --frozen-lockfile`
- `bun run db:start`
- `supabase status`
- `bun run db:migrate`
- `bun run dev`
- `bun run check`
- `bun run lint`
- `bun run format`
- `bun run format:fix`
- `bun run build`
- `bun run test`

## Local Supabase

This project uses the Supabase CLI for the local Supabase stack and Drizzle
for schema ownership and SQL migrations.

- Start Supabase services with `bun run db:start`.
- Copy the local API URL, anon key, and service role key from `supabase status`
  into `.env`.
- Apply database migrations with `bun run db:migrate`.
- Generate new migrations from the TypeScript schema with
  `bun run db:generate`.
- Open local Supabase Studio at `http://127.0.0.1:54323`.

## Shape

- `apps/web` is the Vercel-deployed Next.js app.
- `packages/server` contains the Hono backend mounted by the Next API route.
- `packages/ui` contains shared React UI components.
- `packages/apps-config` and `packages/typescript-config` contain shared tooling defaults.
