# Eskwelabs Advisor — Agent Guide

Entry-point doc. For deep dives, see `agents/*`:

- [ARCHITECTURE.md](agents/ARCHITECTURE.md) — full architecture, patterns, domain inventory
- [API_CONTRACT.md](agents/API_CONTRACT.md) — all API endpoints & method signatures
- [DATABASE.md](agents/DATABASE.md) — table schemas, relationships, migrations
- [CHANGE_PROCESS.md](agents/CHANGE_PROCESS.md) — protocol for making changes (READ FIRST before any edit)
- [PRD.md](agents/PRD.md) — business requirements, FRs, NFRs, edge cases, acceptance criteria
- [DEVELOPMENT-FLOW.md](agents/DEVELOPMENT-FLOW.md) — phased implementation guide (grain-of-salt reference)

## Agent Workflow

When asked to build a new feature, fix a bug, or make any code change:

1. Read the relevant section in [PRD.md](agents/PRD.md) for business rules and edge cases
2. Read [CHANGE_PROCESS.md](agents/CHANGE_PROCESS.md) and construct a plan adhering to architecture patterns, DI wiring, and access control
3. Propose the plan before writing any code

## Quick Reference

- **Monorepo**: Turborepo + Bun workspaces, single `bun.lock`
- **Packages**: `apps/web` (Next.js 15), `packages/server` (Hono 4 API), `packages/ui` (shared components), `packages/apps-config` (ESLint), `packages/typescript-config` (tsconfigs)
- **Server mount**: `apps/web/src/app/api/[[...route]]/route.ts` — catch-all, consumes `@eskwelabs-advisor/server` as **source** (transpiled by Next.js via `next.config.ts`)
- **DI**: `@needle-di/core` — `packages/server/src/di/container.ts` (InjectionToken + Container)

## Commands

| Command                        | What it does                                    | Notes                                                               |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| `bun run dev`                  | `turbo dev` — dev servers for all packages      |                                                                     |
| `bun run dev:web`              | `turbo dev --filter=@eskwelabs-advisor/web`     | Next.js on port 3000                                                |
| `bun run build`                | `turbo build` — builds all packages             |                                                                     |
| `bun run check`                | `turbo check` → `tsc --noEmit` per package      | Type-checking, NOT a build                                          |
| `bun run lint`                 | `turbo lint` → ESLint 9 flat config             |                                                                     |
| `bun run format:fix`           | Prettier at monorepo root                       | Single quotes, no trailing comma                                    |
| `bun run test`                 | `turbo test`                                    | Test depends on `^build` in turbo pipeline                          |
| `bun test`                     | Bun test runner (per-package)                   | Not Jest/Vitest                                                     |
| `bun run db:generate`          | `drizzle-kit generate`                          | Root config, schema at `packages/server/src/db/drizzle-schema.ts`   |
| `bun run db:migrate`           | `drizzle-kit migrate`                           | Migrations in `packages/server/drizzle/`                            |
| `bun run db:start` / `db:stop` | `supabase start` / `supabase stop`              |                                                                     |
| `bun run prepare`              | `husky` — installs Git hooks into `.git/hooks/` | Runs automatically on `bun install`; run manually after first clone |

## Project Map

### Top-level

```
.
├── apps/web/          # Next.js 15 App Router frontend
├── packages/
│   ├── server/        # Hono 4 API (source, not built)
│   ├── ui/            # Shared React components (button, card, cn)
│   ├── apps-config/   # ESLint 9 flat config
│   └── typescript-config/  # Shared tsconfigs (base.json, next.json)
├── .husky/            # Git hooks (pre-commit: lint-staged, pre-push: check + test)
├── agents/            # Supplementary docs
├── scripts/           # Helper scripts
├── supabase/          # Supabase local config
├── turbo.json         # Turborepo pipeline
└── drizzle.config.ts  # Drizzle Kit config
```

### Backend Domains (`packages/server/src/<domain>/`)

| Domain           | Files                                                                                                          | Key DI Tokens                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `admin`          | controller, service, repository, serializer, schema (stub), access-policy, use-cases, dto, tests               | AdminController, AdminService, AdminRepository                        |
| `advisors`       | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | AdvisorController, AdvisorsService, AdvisorsRepository                |
| `conversations`  | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | ConversationController, ConversationsService, ConversationsRepository |
| `messages`       | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | MessageController, MessagesService, MessagesRepository                |
| `model-config`   | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | ModelConfigController, ModelConfigService, ModelConfigRepository      |
| `prompt-cache`   | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | PromptCacheController, PromptCacheService, PromptCacheRepository      |
| `usage-counters` | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests (+ cost-cap.service) | UsageCounterController, UsageCountersService, UsageCountersRepository |
| `telemetry`      | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | TelemetryController, TelemetryService, TelemetryRepository            |
| `users`          | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                      | UsersController, UsersService, UsersRepository                        |

Cross-cutting: `auth/` (auth-request.ts, auth.service.ts), `cache/` (redis.service.ts), `rate-limit/` (rate-limit.service.ts), `config/` (env.ts), `adapters/` (advisor-adapters.ts), `db/` (drizzle.service.ts), `di/` (container.ts), `common/factories/` (controller.factory.ts, repository.factory.ts), `common/middleware/` (auth.middleware.ts, error.middleware.ts, rate-limit.middleware.ts, security.middleware.ts, validation.middleware.ts), `common/http/` (http-exception.ts), `common/utils/` (client-ip.ts, day-ph.ts, hono.ts)

### Frontend Domains (`apps/web/src/`)

| Route Group      | Pages             | Features            | Domain Libs                            |
| ---------------- | ----------------- | ------------------- | -------------------------------------- |
| `(auth)/login`   | login/page.tsx    | LoginPanel          | domains/auth/{api,session,queries}.ts  |
| `(auth)/consent` | consent/page.tsx  | ConsentNotice       | domains/auth/{api,session,queries}.ts  |
| `(app)/advisors` | advisors/page.tsx | AdvisorSelection    | domains/advisors/{api,queries}.ts      |
| `(app)/chat`     | chat/page.tsx     | ChatShell           | domains/chat/{api,queries}.ts          |
| `(app)/history`  | history/page.tsx  | ConversationHistory | domains/conversations/{api,queries}.ts |
| `admin`          | admin/page.tsx    | AdminDashboard      | domains/admin/{api,queries}.ts         |

### Database Tables

`advisors`, `users`, `conversations`, `messages`, `model_config`, `prompt_cache`, `usage_counters`, `telemetry_events` — see [DATABASE.md](agents/DATABASE.md).

## Auth & CSP

- **Cookie-based auth**: `eskwelabs_actor_email`, `eskwelabs_actor_id`, `eskwelabs_actor_role`, `eskwelabs_actor_active` cookies set by middleware
- **Next.js middleware** (`apps/web/src/middleware.ts`): resolves actor from cookies, gates EIF routes (`/advisors`, `/chat`, `/history`, `/consent` + API paths) and admin routes (`/admin`, `/api/admin`) against `ADMIN_EMAILS` / `EIF_ALLOWLIST_EMAILS` env vars. Sets `x-eskwelabs-actor-*` request headers.
- **Hono middleware** (`auth.middleware.ts`): reads `x-eskwelabs-actor-*` headers, sets `c.get('actor')`. Three helpers: `createAuthMiddleware`, `requireActor(roles)`, `requireAllowlistedEifOrAdmin`
- **CSP**: Nonce-based in `middleware.ts`. Layout calls `await headers()` to force dynamic rendering per-request.

## Key Env Vars

Defined in `packages/server/src/config/env.ts` via zod schema. All declared in `turbo.json` `globalPassThroughEnv`:
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_DOCS_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_DOCS_PROMPT_DOC_ID`, `GOOGLE_DOCS_DNA_DOC_ID`, `GOOGLE_DOCS_API_KEY`, `GEMINI_API_KEY`, `EIF_ALLOWLIST_EMAILS`, `ADMIN_EMAILS`, `DAILY_MESSAGE_LIMIT`, `DAILY_TOKEN_LIMIT`, `DAILY_SPEND_LIMIT_USD`, `DEFAULT_MAX_OUTPUT_TOKENS`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`

## Quirks

- `bun run check` = type-checking, NOT a build
- Server has no real build step — `tsc --noEmit` only
- Drizzle config is at monorepo root, schema source is `packages/server/src/db/drizzle-schema.ts`
- Postgres driver is `postgres` (npm), not `pg` or `@neondatabase/serverless`
- Tailwind CSS v4 with `@tailwindcss/postcss` (no `tailwind.config.js`)
- Path alias `@/` maps to `apps/web/src/*` in web, `packages/server/src/*` in server
- Repos currently use **in-memory Maps** (not yet backed by Drizzle queries)
- Adapters (`advisor-adapters.ts`) are deterministic stubs — no real LLM/Google Docs calls
- Supabase clients (`client.ts`, `server.ts`) return `null` — stubs
- All frontend components are placeholders
- **Git hooks** (Husky v9 + lint-staged): `pre-commit` runs Prettier + ESLint on staged files; `pre-push` runs `turbo check` + `turbo test`. Skip with `--no-verify` in emergencies. `git add -p` partial-hunk staging will cause lint-staged to reformat the whole file — commit the full file in that case.

## Development Process

> **PRD**: Business requirements in [PRD.md](agents/PRD.md). Implementation guide in [DEVELOPMENT-FLOW.md](agents/DEVELOPMENT-FLOW.md) (grain of salt).

Before making any change, read [CHANGE_PROCESS.md](agents/CHANGE_PROCESS.md) and construct a plan that:

1. Adheres to the backend/frontend architecture patterns
2. Follows the PRD logic — all edge cases, business rules, FRs/NFRs
3. Respects the DI wiring in `container.ts`
4. Considers error handling, access control, validation, serialization
5. Uses existing factories (Controller, Repository) and patterns
6. Updates agents markdowns if the change adds/modifies domains, tables, or endpoints

## Blueprint for Updating This File

When the codebase changes (new domain, new table, new route, new env var, package changes), update the sections above:

1. **Commands** — if a new `bun run` script is added
2. **Project Map** — if packages are added/removed
3. **Backend Domains** — add new domain row (domain name, files present, DI token names)
4. **Frontend Domains** — add new route group or pages
5. **Database Tables** — add/remove tables
6. **Auth & CSP** — if auth flow changes
7. **Key Env Vars** — if env vars are added/removed
8. **Quirks** — if any new unexpected behavior emerges

Also update the corresponding `agents/*` files for deep-dive details.
