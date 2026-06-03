# Eskwelabs Advisor — Agent Guide

## Prerequisites

- Bun 1.3+, Node >=22
- `bun install --frozen-lockfile` (lockfile is `bun.lock`)
- Local Supabase: `bun run db:start` → `supabase status` (copy keys) → `.env` → `bun run db:migrate`
- `.env` is gitignored; copy from `.env.example`

## Commands

| Command | What it does | Notes |
|---|---|---|
| `bun run dev` | `turbo dev` — dev servers for all packages | |
| `bun run dev:web` | `turbo dev --filter=@eskwelabs-advisor/web` | Next.js on port 3000 |
| `bun run build` | `turbo build` — builds all packages | |
| `bun run check` | `turbo check` → `tsc --noEmit` per package | Type-checking, NOT a build |
| `bun run lint` | `turbo lint` → ESLint 9 flat config | |
| `bun run format:fix` | Prettier at monorepo root | Single quotes, no trailing comma |
| `bun run test` | `turbo test` | Test depends on `^build` in turbo pipeline |
| `bun test` | Bun test runner (per-package) | Not Jest/Vitest |
| `bun run db:generate` | `drizzle-kit generate` | Root-level config reads `packages/server/src/db/drizzle-schema.ts` |
| `bun run db:migrate` | `drizzle-kit migrate` | Migrations in `packages/server/drizzle/` |
| `bun run db:start` / `db:stop` | `supabase start` / `supabase stop` | |

## Architecture

- **Turborepo monorepo** with Bun workspaces in `apps/*` and `packages/*`
- **`apps/web`** — Next.js 15 App Router (no `_app.tsx`/`_document.tsx`)
- **`packages/server`** — Hono 4 API, consumed as **source** (not built) via `transpilePackages` in next.config.ts. Mounted at `apps/web/src/app/api/[[...route]]/route.ts` using `hono/vercel`
- **`packages/ui`** — Shared React components, also consumed as source
- **`packages/apps-config`** — ESLint 9 flat config (`@eskwelabs-advisor/apps-config/eslint`)
- **`packages/typescript-config`** — Shared tsconfigs (`base.json`, `next.json`)
- **`agents/`** directory contains supplementary docs (`BACKEND.md`, `API_CONTRACT.md`, `DATABASE.md`)

## Server domain layout

Each domain under `packages/server/src/<domain>/` follows:
```
<domain>.schema.ts + dto/ + <domain>.repository.ts + <domain>.service.ts
+ <domain>.serializer.ts + <domain>-access.policy.ts + use-cases/
+ tests/ + <domain>.controller.ts
```

- Controllers extend `Controller` (Hono factory from `common/factories/controller.factory.ts`)
- Repositories extend `Repository` factory
- All Drizzle schemas re-exported from `db/drizzle-schema.ts` with `snake_case` casing
- DI via `@needle-di/core` in `di/container.ts` (InjectionToken + Container)

## Auth + CSP

- **Authentication**: Cookie-based (`eskwelabs_actor_email`, `eskwelabs_actor_id`, etc.). Middleware reads cookies, resolves actor, and sets `x-eskwelabs-actor-*` request headers. Hono backend reads these headers in `auth.middleware.ts`
- **Access control**: Admin routes (`/admin`, `/api/admin`) and EIF routes (`/advisors`, `/chat`, `/history`, `/consent`, and their API paths) are gated by `ADMIN_EMAILS` / `EIF_ALLOWLIST_EMAILS` env vars
- **CSP**: Nonce-based policy set in `middleware.ts`. Layout calls `await headers()` to force dynamic rendering so the nonce is fresh per-request

## Key env vars (all in `turbo.json` globalPassThroughEnv)

`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_DOCS_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`

## Quirks

- `bun run check` is type-checking, not a build — despite the name
- Server package `build` script is `tsc --noEmit` (same as `check`); no real server build step exists
- Drizzle config is at monorepo root, schema source is `packages/server/src/db/drizzle-schema.ts`
- `conversations` controller lives in `packages/server/src/conversations/` (no corresponding web route at app level — it's an API domain)
- Hono typed client (`hc<ApiRoutes>('/').api`) used for frontend → API calls
- `@/` path alias maps to `apps/web/src/*`
- Path `apps/web/src/app/api/[[...route]]/route.ts` is the catch-all Hono entrypoint
- Postgres driver is `postgres` (npm), not `pg` or `@neondatabase/serverless`
- Prettier includes `prettier-plugin-tailwindcss` for Tailwind class sorting
- Tailwind CSS v4 with `@tailwindcss/postcss` (no `tailwind.config.js`)
