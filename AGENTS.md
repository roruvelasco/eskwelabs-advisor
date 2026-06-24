# Eskwelabs Advisor — Agent Guide

Entry-point doc. For deep dives, see `agents/*`:

- [ARCHITECTURE.md](agents/ARCHITECTURE.md) — full architecture, patterns, domain inventory
- [API_CONTRACT.md](agents/API_CONTRACT.md) — all API endpoints & method signatures
- [DATABASE.md](agents/DATABASE.md) — table schemas, relationships, migrations
- [CHANGE_PROCESS.md](agents/CHANGE_PROCESS.md) — protocol for making changes (READ FIRST before any edit)
- [PRD.MD](agents/PRD.MD) — business requirements, FRs, NFRs, edge cases, acceptance criteria
- [DEVELOPMENT-FLOW.MD](agents/DEVELOPMENT-FLOW.MD) — phased implementation guide (grain-of-salt reference)
- [UI-PRACTICES.md](agents/UI-PRACTICES.md) — UI component principles (shadcn foundation, design tokens, motion)

## Agent Workflow

When asked to build a new feature, fix a bug, or make any code change:

1. Read the relevant section in [PRD.MD](agents/PRD.MD) for business rules and edge cases
2. Read [CHANGE_PROCESS.md](agents/CHANGE_PROCESS.md) and construct a plan adhering to architecture patterns, DI wiring, and access control
3. Propose the plan before writing any code

## Quick Reference

- **Monorepo**: Turborepo + Bun workspaces, single `bun.lock`
- **Packages**: `apps/web` (Next.js 15), `packages/server` (Hono 4 API), `packages/ui` (shadcn-based React components + layout components + responsive hooks), `packages/apps-config` (ESLint), `packages/typescript-config` (tsconfigs)
- **Server mount**: `apps/web/src/app/api/[[...route]]/route.ts` — catch-all, consumes `@eskwelabs-advisor/server` as **source** (transpiled by Next.js via `next.config.ts`)
- **DI**: `@needle-di/core` — `packages/server/src/di/container.ts` (InjectionToken + Container)

## Commands

| Command                        | What it does                                        | Notes                                                                        |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `bun run dev`                  | `turbo dev` — dev servers for all packages          |                                                                              |
| `bun run dev:web`              | `turbo dev --filter=@eskwelabs-advisor/web`         | Next.js on port 3000                                                         |
| `bun run build`                | `turbo build` — builds all packages                 |                                                                              |
| `bun run check`                | `turbo check` → `tsc --noEmit` per package          | Type-checking, NOT a build                                                   |
| `bun run lint`                 | `turbo lint` → ESLint 9 flat config                 |                                                                              |
| `bun run format:fix`           | Prettier at monorepo root                           | Single quotes, no trailing comma                                             |
| `bun run test`                 | `turbo test`                                        | Test depends on `^build` in turbo pipeline                                   |
| `bun test`                     | Bun test runner (per-package)                       | Not Jest/Vitest                                                              |
| `bun run db:generate`          | `drizzle-kit generate`                              | Root config, schema at `packages/server/src/db/drizzle-schema.ts`            |
| `bun run db:migrate`           | `drizzle-kit migrate`                               | Migrations in `packages/server/drizzle/`                                     |
| `bun run db:sync-advisors`     | Upserts active advisor registry + prompt Doc IDs    | Also retires legacy `advisor-3` in favor of `data-modeling`                  |
| `bun run db:reset`             | Nuke → migrate → sync → bootstrap → seed → validate | Single-command full DB setup                                                 |
| `bun run db:prod`              | Interactively seeds Supabase prod DB                | Prompts for ref, password; runs migrate → sync → bootstrap → seed → validate |
| `bun run db:start` / `db:stop` | `supabase start` / `supabase stop`                  |                                                                              |
| `bun run prepare`              | `husky` — installs Git hooks into `.git/hooks/`     | Runs automatically on `bun install`; run manually after first clone          |

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

| Domain                | Files                                                                                                                     | Key DI Tokens                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`               | controller, service, repository, serializer, schema (stub), access-policy, use-cases, dto, tests                          | AdminController, AdminService, AdminRepository                                                                                            |
| `advisors`            | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                                 | AdvisorController, AdvisorsService, AdvisorsRepository                                                                                    |
| `conversations`       | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                                 | ConversationController, ConversationsService, ConversationsRepository                                                                     |
| `conversation-titles` | controller, worker, generator, normalizer, model resolver, repository, schema, successful-turn persistence                | ConversationTitleJobsController, ConversationTitleWorker, ConversationTitleGenerator, ConversationTitleJobsRepository                     |
| `messages`            | controller, service, repository, serializer, schema, query-policy, access-policy, use-cases, dto, tests                   | MessageController, MessagesService, MessagesRepository, QueryPolicyService                                                                |
| `knowledge`           | controller (& jobs), ingestion/context resolver services, repository, serializer, schemas, dto, tests                     | KnowledgeController, KnowledgeJobsController, KnowledgeService, KnowledgeRepository, KNOWLEDGE_CONTEXT_RESOLVER                           |
| `model-config`        | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                                 | ModelConfigController, ModelConfigService, ModelConfigRepository                                                                          |
| `prompt-cache`        | controller (& jobs), ingestion/context services, repositories, serializers, schemas, access-policy, use-cases, dto, tests | PromptCacheController, PromptCacheJobsController, PromptCacheService, PromptCacheRepository, PromptIngestionService, PromptContextService |
| `usage-counters`      | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests (+ cost-cap.service)            | UsageCounterController, UsageCountersService, UsageCountersRepository                                                                     |
| `usage-limits`        | controller, service, repository, serializer, schema, dto                                                                  | UsageLimitsController, UsageLimitsService, UsageLimitsRepository                                                                          |
| `telemetry`           | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                                 | TelemetryController, TelemetryService, TelemetryRepository                                                                                |
| `users`               | controller, service, repository, serializer, schema, access-policy, use-cases, dto, tests                                 | UsersController, UsersService, UsersRepository                                                                                            |

Cross-cutting: `auth/` (auth-request.ts, auth.service.ts), `cache/` (redis.service.ts), `rate-limit/` (rate-limit.service.ts), `config/` (env.ts), `adapters/` (advisor-adapters.ts), `db/` (drizzle.service.ts), `di/` (container.ts), `common/factories/` (controller.factory.ts, repository.factory.ts), `common/middleware/` (auth.middleware.ts, error.middleware.ts, rate-limit.middleware.ts, security.middleware.ts, validation.middleware.ts), `common/http/` (http-exception.ts), `common/utils/` (client-ip.ts, day-ph.ts, hono.ts)

### Frontend Domains (`apps/web/src/`)

| Route Group      | Pages             | Features                                                 | Domain Libs                            |
| ---------------- | ----------------- | -------------------------------------------------------- | -------------------------------------- |
| `(auth)/login`   | login/page.tsx    | LoginPanel                                               | domains/auth/{api,session,queries}.ts  |
| `(auth)/consent` | consent/page.tsx  | Redirects to app; active notice is ConsentDialog in chat | domains/auth/{api,session,queries}.ts  |
| `(app)/advisors` | advisors/page.tsx | AdvisorSelection                                         | domains/advisors/{api,queries}.ts      |
| `(app)/chat`     | chat/page.tsx     | ChatShell                                                | domains/chat/{api,queries}.ts          |
| `(app)/history`  | history/page.tsx  | ConversationHistory                                      | domains/conversations/{api,queries}.ts |
| `admin`          | admin/page.tsx    | AdminDashboard                                           | domains/admin/{api,queries}.ts         |

### UI Components (`packages/ui/src/`)

**shadcn components** (`src/components/ui/`): Button, Card, Badge, Input, Textarea, Dialog, DropdownMenu, Tabs, Tooltip, Avatar, ScrollArea, Separator, Select, Table, Popover, Accordion, Switch, Skeleton, Sheet, Drawer

**Layout components** (`src/components/layout/`): Container, Stack, Grid — reusable wrappers that replace inline `<div className="mx-auto max-w-5xl px-6">` soup.

**Hooks** (`src/hooks/`): `useMediaQuery(query)`, `useIsMobile(breakpoint?)`, `useBreakpoint()` — import from `@eskwelabs-advisor/ui/hooks`.

**Pattern**: shadcn components use Radix primitives + `class-variance-authority` + `cn()` utility with CSS token references (`bg-primary`, `text-muted-foreground`, `border-border`).

**shadcn workflow**: `npx shadcn@latest add <component> -c apps/web --yes` → move to `packages/ui/src/components/ui/` → update barrel at `packages/ui/src/index.ts`.

### Database Tables

`advisors`, `users`, `conversations`, `messages`, `model_config`, `prompt_cache`, `prompt_snapshots`, `dna_digests`, `knowledge_sources`, `knowledge_units`, `knowledge_embeddings`, `knowledge_rules`, `message_knowledge_audit`, `usage_counters`, `usage_limits`, `usage_budget_counters`, `telemetry_events`, `advisor_runtime_versions`, `conversation_title_jobs` — see [DATABASE.md](agents/DATABASE.md). RLS is enabled on all tables (see DATABASE.md §Row-Level Security).

## Design System

All styling tokens live in `apps/web/src/styles/globals.css` as CSS custom properties (OKLCH color space):

- **Colors**: `--background`, `--foreground`, `--primary` (`#2d6a4f` elegant green), `--ring` (`#d4a373` warm gold), `--muted`, `--accent`, `--destructive`, etc.
- **Radius**: `--radius: 0.625rem` — mapped to `rounded-sm/md/lg/xl` via `@theme inline`
- **Typography**: `--font-sans` (Inter), `--font-serif` (Fraunces)
- **Motion**: `tw-animate-css` for enter/exit animations + custom motion utilities (`.motion-lift`, `.motion-press`, `.motion-pop`, `.motion-pulse-ring`, `.motion-stagger-in`)
- **Variant**: Custom `@custom-variant` declarations for `data-open`, `data-closed`, `data-checked`, etc.
- **Dark mode**: `.dark` class via `@custom-variant dark`

To change the look, edit the CSS variables — not component files. See [UI-PRACTICES.md](agents/UI-PRACTICES.md) for full principles.

## Auth & CSP

- **Cookie-based auth**: `eskwelabs_actor_email`, `eskwelabs_actor_id`, `eskwelabs_actor_role`, `eskwelabs_actor_active` cookies set by middleware (httpOnly)
- **Role-specific login**: EIF login uses NextAuth provider IDs `google` / `credentials`; admin login uses `google-admin` / `credentials-admin`. Both Google and credentials resolve against the Supabase/Postgres `users` allow-list, and the sign-in callback rejects role mismatches before creating a JWT session.
- **Next.js middleware** (`apps/web/src/middleware.ts`): reads JWT via `getToken()`, gates routes against JWT claims (`role`, `isActive`). Signs forwarded actor headers with HMAC-SHA256 (`ACTOR_FORWARDING_SECRET`) including method, path, timestamp, and nonce. Strips incoming forged actor/signature headers before setting trusted values. Never queries Postgres.
- **Strict role split**: Admin sessions are redirected away from EIF app routes to `/admin`; EIF sessions are redirected away from admin pages to `/advisors`. Admin APIs and EIF APIs return 403 for the wrong role.
- **Hono middleware** (`auth.middleware.ts`): `createAuthMiddleware(usersService, env)` verifies HMAC signature and timestamp freshness (300s TTL) before trusting forwarded `id`/`email`. Then validates against the `users` table via `UsersService`, sets `c.get('actor')` from DB role/status. Two helpers: `requireActor(roles)` for route gating.
- **Client session**: `/api/session` route handler verifies NextAuth JWT server-side and returns `{ data: SessionActor | null }`. Frontend `sessionQuery` calls this endpoint instead of reading httpOnly cookies from `document.cookie`.
- **Allowlist source**: `users` table (Supabase/Postgres) — `email`, `role`, `is_active`. Bootstrap by inserting the first admin row directly into Supabase before first login.
- **CSP**: Nonce-based in `middleware.ts`. Layout calls `await headers()` to force dynamic rendering per-request.

## Key Env Vars

Defined in `packages/server/src/config/env.ts` via zod schema. All declared in `turbo.json` `globalPassThroughEnv`:
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_DOCS_SERVICE_ACCOUNT_JSON`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_DOCS_DNA_DOC_ID`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY`, `GROQ_BASE_URL`, `PROVIDER_TIMEOUT_MS`, `DAILY_MESSAGE_LIMIT`, `DAILY_TOKEN_LIMIT`, `DAILY_SPEND_LIMIT_USD`, `DEFAULT_MAX_OUTPUT_TOKENS`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `CREDENTIAL_LOGIN_MAX_ATTEMPTS`, `CREDENTIAL_LOGIN_LOCKOUT_SECONDS`, `RUNTIME_PROFILE`, `LLM_PROVIDER_MODE`, `PROMPT_PROVIDER_MODE`, `TITLE_GENERATION_PROVIDER`, `TITLE_GENERATION_MODEL`, `CRON_SECRET`, `ACTOR_FORWARDING_SECRET`

## Code Style

- **DO NOT** add comments unless absolutely necessary (explaining a non-obvious edge case or reason).
- Standard library code (Drizzle schemas, Zod DTOs, Hono routes, `@needle-di` DI wiring) should never be commented — the patterns are self-documenting.
- Code is documentation. A comment that says _what_ the code does is waste — only explain _why_ when the reason isn't obvious.
- This saves tokens for AI agents reading the codebase.

## Quirks

- `bun run check` = type-checking, NOT a build
- Server has no real build step — `tsc --noEmit` only
- Drizzle config is at monorepo root, schema source is `packages/server/src/db/drizzle-schema.ts`
- Postgres driver is `postgres` (npm), not `pg` or `@neondatabase/serverless`
- Tailwind CSS v4 with `@tailwindcss/postcss` (no `tailwind.config.js`)
- **Tailwind v4: `@source` directive required** — `globals.css` must include `@source '../../node_modules/@eskwelabs-advisor/ui/src'` so Tailwind scans class names used inside `packages/ui`. Without this, any Tailwind class used only in shared components gets purged in production.
- **Tailwind v4: `@utility` syntax** — custom utilities are declared with `@utility name { ... }` (replaces the old `@layer utilities` + plugin approach). Example: `@utility no-scrollbar { scrollbar-width: none; }`
- **Tailwind v4: `not-{breakpoint}:` variant** — `not-md:` means "apply only when NOT at md breakpoint and above." This is v4-only — v3 does not have this. Do not confuse with `max-md:` ("below md").
- **Tailwind v4: responsive variant direction** — `max-md:` = below 768px (desktop-down). `not-md:` = everywhere except exactly at `md`. Prefer mobile-first (`md:`) over `max-md:` except for targeted overrides.
- Path alias `@/` maps to `apps/web/src/*` in web, `packages/server/src/*` in server
- All repositories use **Drizzle ORM query builder** (`this.drizzle.db`). `usage-counters` and `conversation-title-jobs` also use raw SQL via `sql\`...\``for advisory locks /`FOR UPDATE SKIP LOCKED`
- Adapters (`advisor-adapters.ts`) are deterministic stubs — no real LLM/Google Docs calls
- Supabase clients (`client.ts`, `server.ts`) return `null` — stubs
- All frontend components are placeholders (feature pages), but UI components in `packages/ui` are real shadcn components
- `apps/web/src/lib/utils.ts` re-exports `cn` from `@eskwelabs-advisor/ui/utils` — necessary for shadcn CLI compatibility
- shadcn v4 generates Radix imports from the `radix-ui` meta-package (not individual `@radix-ui/react-*` packages)
- **shadcn CLI requires `-c apps/web`** — the `components.json` lives at `apps/web/components.json` and controls path aliases. Always run `npx shadcn@latest add <component> -c apps/web --yes`, then manually move the generated file from `apps/web/src/components/ui/` to `packages/ui/src/components/ui/` and add its export to `packages/ui/src/index.ts`.
- **Git hooks** (Husky v9 + lint-staged): `pre-commit` runs Prettier + ESLint on staged files; `pre-push` runs `turbo check` + `turbo test`. Skip with `--no-verify` in emergencies. `git add -p` partial-hunk staging will cause lint-staged to reformat the whole file — commit the full file in that case.

## Development Process

> **PRD**: Business requirements in [PRD.MD](agents/PRD.MD). Implementation guide in [DEVELOPMENT-FLOW.MD](agents/DEVELOPMENT-FLOW.MD) (grain of salt).

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
