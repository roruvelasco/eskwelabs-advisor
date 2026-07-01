# Eskwelabs Advisor

Internal AI advisor platform for Eskwelabs EIF mentoring. Brokers EIF↔LLM conversations with full control over prompts, logs, models, and spend. Three advisors (Data Dashboard, SSOT Memo, Data Modeling) grounded in a shared Eskwelabs DNA knowledge base.

## Stack

| Layer             | Technology                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| **Frontend**      | Next.js 15 App Router, Tailwind CSS v4, shadcn/ui                          |
| **Backend**       | Hono 4 API (source-transpiled via Next.js)                                 |
| **Runtime**       | Bun 1.3+, Turborepo monorepo                                               |
| **Database**      | Supabase (Postgres), Drizzle ORM, pgvector                                 |
| **Cache**         | Redis (Upstash / in-memory fallback)                                       |
| **Auth**          | NextAuth v4 (Google OAuth2 + credentials), HMAC-signed actor forwarding    |
| **LLM Providers** | Groq, Gemini, OpenRouter (multi-provider via adapter pattern)              |
| **Prompts & DNA** | Google Docs API (read-only, TTL-cached)                                    |
| **UI Components** | Radix UI primitives, `class-variance-authority`, `recharts` (admin charts) |

## Architecture

```
eskwelabs-advisor/
├── apps/web/                 # Next.js 15 (Vercel-deployed)
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── (auth)/       # Login, consent
│   │   │   ├── (app)/        # Advisors, chat, history (w/ AppShell)
│   │   │   ├── admin/        # Admin dashboard
│   │   │   └── api/[[...route]]/  # Hono catch-all route.ts
│   │   ├── features/         # Domain-scoped feature components
│   │   │   ├── admin/        # Usage, limits, telemetry, model-config, advisors, cache, knowledge panels
│   │   │   ├── advisors/     # Advisor selection with showcase visuals
│   │   │   ├── auth/         # Login panel (shared by admin + EIF)
│   │   │   ├── chat/         # Chat shell, sidebar, streaming
│   │   │   └── conversations/# History list
│   │   ├── lib/domains/      # Per-domain API client + TanStack Query options
│   │   └── middleware.ts     # Auth gating, CSP nonce, HMAC header forwarding
│   └── public/images/        # Static assets
│
├── packages/
│   ├── server/               # Hono 4 API (14 domain modules)
│   │   └── src/
│   │       ├── advisors/     # Advisor CRUD, registry, runtime publishing
│   │       ├── messages/     # Chat turns, streaming, knowledge context
│   │       ├── conversations/# Threads, title generation
│   │       ├── users/        # Allow-list, consent
│   │       ├── model-config/ # Per-advisor model selection, provider catalog
│   │       ├── prompt-cache/ # Google Docs ingestion, snapshot versioning, Redis
│   │       ├── knowledge/    # Source-backed units, vector search, rules
│   │       ├── usage-counters/ # Per-user PH-day counters, cost estimates
│   │       ├── usage-limits/ # Global caps, budget ceilings, audit events
│   │       ├── telemetry/    # Structured event logging
│   │       ├── admin/        # Dashboard overview
│   │       ├── conversation-titles/ # Background title generation workers
│   │       ├── auth/         # DB-backed actor resolution, credential rate-limiting
│   │       ├── cache/        # Redis service (with in-memory fallback)
│   │       ├── rate-limit/   # Per-user and global request rate limiting
│   │       ├── config/       # Zod-validated ServerEnv schema
│   │       ├── di/           # @needle-di/core container wiring
│   │       ├── adapters/     # LLM provider adapters (Groq, Gemini, OpenRouter, Deterministic)
│   │       ├── common/       # Factories, middleware (auth, error, rate-limit, security, validation)
│   │       └── db/           # DrizzleService, drizzle-schema (45+ tables)
│   │
│   ├── ui/                   # Shared React components
│   │   └── src/
│   │       ├── components/ui/# Button, Card, Badge, Dialog, Select, Table, etc.
│   │       └── hooks/        # useMediaQuery, useIsMobile, useBreakpoint
│   │
│   ├── apps-config/          # ESLint 9 flat config
│   └── typescript-config/    # Shared tsconfig presets
│
├── agents/                   # Supplementary documentation
├── scripts/                  # DB seeding, sync, validation
└── supabase/                 # Local Supabase config
```

## Getting Started

### Prerequisites

- **Bun** ≥ 1.3.0 (`curl -fsSL https://bun.sh/install | bash`)
- **Supabase CLI** (`brew install supabase/tap/supabase` or `npm install -g supabase`)
- **Docker** (for Supabase local stack)

### Setup

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Start local Supabase
bun run db:start

# Copy Supabase local credentials from `supabase status` into .env:
#   DATABASE_URL, SUPABASE_URL (anon), SUPABASE_SERVICE_ROLE_KEY

# Apply migrations
bun run db:migrate

# Sync advisor registry + seed demo data
bun run db:sync-advisors
bun run db:bootstrap-demo

# Start dev servers (Next.js on :3000, Hono via Next API route)
bun run dev
```

### Full DB Reset

```bash
bun run db:reset
```

Nukes, migrates, syncs, bootstraps, seeds, and validates — single command.

### Production Seed (Supabase)

```bash
bun run db:prod
```

Prompts for production Supabase ref + password, runs full setup.

## Common Commands

| Command                        | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `bun run dev`                  | Start all dev servers                        |
| `bun run dev:web`              | Next.js only (faster)                        |
| `bun run check`                | Type-check (tsc --noEmit)                    |
| `bun run lint`                 | ESLint 9                                     |
| `bun test`                     | Bun test runner                              |
| `bun run format:fix`           | Prettier (single quotes, no trailing commas) |
| `bun run db:generate`          | Generate Drizzle migration                   |
| `bun run db:migrate`           | Apply pending migrations                     |
| `bun run db:start` / `db:stop` | Supabase local lifecycle                     |
| `bun run db:sync-advisors`     | Upsert advisor registry + prompt Doc IDs     |

## Key Features

### Auth & Security

- **Role-specific login**: EIF login at `/login`, admin login at `/admin/login` — separate NextAuth providers, strict role gating
- **Allow-list**: Only users in the `users` table can authenticate; role mismatches rejected before JWT creation
- **HMAC-signed headers**: Actor identity forwarded from Next.js middleware to Hono with HMAC-SHA256 + timestamp + nonce
- **CSP**: Nonce-based Content Security Policy on every response
- **RLS**: Row-level security on all Supabase tables — EIFs read only their own data

### Admin Dashboard

- **Usage panel**: Aggregate and per-user token/cost trends, CSV export, date range picker
- **Model config**: Per-advisor provider/model selection via backend-driven catalog (Groq, Gemini, OpenRouter)
- **Advisor management**: Create, edit, publish, disable advisors with prompt source mapping
- **Prompt cache**: View snapshot versions, rollback, trigger DNA refresh, manage DNA source Doc ID
- **Knowledge panel**: Ingest Google Doc sources, view units, refresh all sources
- **Usage limits**: Configure daily/global caps, view budget status and enforcement audit trail
- **Telemetry**: Browsable event log with search and pagination

### Chat

- **Streaming**: SSE token-by-token streaming with abort support
- **Multi-turn**: Full conversation history preserved in context
- **Consent notice**: First-run monitoring disclosure
- **Knowledge context**: Query-specific evidence injection (semantic vector search + structured rules)
- **Cost caps**: Hard-blocked when daily messages/tokens/spend exceeded

### Prompt & DNA Management

- **Google Docs source of truth**: Prompts and DNA edited in Docs, no redeploy needed
- **TTL caching**: 5-minute cache with last-good fallback
- **DNA digest**: 30-page DNA doc summarized into a compact digest prepended to every turn
- **Snapshot versioning**: Durable versioned snapshots with rollback support
- **Manual refresh**: Admin can invalidate cache before TTL

### Conversation Title Generation

- **Background worker**: Asynchronous title generation triggered by `SuccessfulTurnPersistenceService`
- **Lease-based claiming**: Workers drain `conversation_title_jobs` with `FOR UPDATE SKIP LOCKED`
- **Multi-model**: Model resolved at runtime, supports Groq/Gemini generation

## Environment Variables

Defined in `packages/server/src/config/env.ts` via Zod schema. Key vars:

- `DATABASE_URL` — Supabase Postgres connection string
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase admin client
- `ACTOR_FORWARDING_SECRET` — HMAC signing key for actor header forwarding
- `LLM_PROVIDER_MODE` — `auto` | `deterministic` | `gemini` | `groq` | `openrouter`
- `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` — LLM provider credentials
- `GOOGLE_REFRESH_TOKEN` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Docs OAuth
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Redis cache
- `DAILY_MESSAGE_LIMIT` / `DAILY_TOKEN_LIMIT` / `DAILY_SPEND_LIMIT_USD` — Cost caps
- `CRON_SECRET` — Shared secret for internal job endpoints
- `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_MAX_REQUESTS` — Rate limiting
- `PROVIDER_TIMEOUT_MS` / `EMBEDDING_PROVIDER_TIMEOUT_MS` — Provider timeouts
- `KNOWLEDGE_SEMANTIC_SYNC_BUDGET_MS` — Semantic search deadline budget

All declared in `turbo.json` `globalPassThroughEnv`. No `.env` files in subdirectories.

## LLM Providers

Configured via `LLM_PROVIDER_MODE`:

- `auto` (default) — all providers with configured API keys are available
- `deterministic` — stub responses (testing/dev)
- `gemini`, `groq`, `openrouter` — single-provider mode

The admin model config panel fetches available providers from the backend catalog (`GET /api/admin/model-config/catalog`). Each advisor's provider/model is set independently.

### Supported Models

| Provider      | Models                                                                                                                                                 | Input $/M tok | Output $/M tok |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------- |
| Groq          | llama-3.3-70b-versatile, llama-3.1-8b-instant                                                                                                          | $0.05–0.59    | $0.08–0.79     |
| Gemini        | gemini-2.0-flash, gemini-2.5-flash-lite, gemini-2.5-flash                                                                                              | $0.10–0.30    | $0.40–2.50     |
| OpenRouter    | meta-llama/llama-3.1-8b-instruct, deepseek/deepseek-v4-flash, meta-llama/llama-3.3-70b-instruct, mistralai/ministral-3b-2512, meta-llama/llama-4-scout | $0.02–0.10    | $0.04–0.32     |
| Deterministic | deterministic-model                                                                                                                                    | $0            | $0             |

## Database

45+ tables across 14 domains. Key tables: `advisors`, `users`, `conversations`, `messages`, `model_config`, `prompt_cache`, `prompt_snapshots`, `dna_digests`, `dna_source_config`, `knowledge_sources`, `knowledge_units`, `knowledge_embeddings`, `knowledge_rules`, `message_knowledge_audit`, `usage_counters`, `usage_limits`, `usage_budget_counters`, `usage_limit_audit_events`, `telemetry_events`, `advisor_runtime_versions`, `conversation_title_jobs`.

RLS is enabled on all tables. See `agents/DATABASE.md` for full schema.

## Testing

```bash
bun run test    # 320+ tests across server + web
bun run check   # Type-check whole monorepo
bun run lint    # ESLint 9
```

Pre-push hook runs `turbo check` + `turbo test`. Pre-commit hook runs Prettier + ESLint on staged files.

## Deployment

Deployed to Vercel. Environment variables set via Vercel project settings. Supabase managed via Supabase dashboard. The `turbo.json` `globalPassThroughEnv` must stay in sync with any new env vars added to `env.ts`.

## Project Map — Backend Domains

Each domain at `packages/server/src/<domain>/` follows a consistent pattern: schema (Drizzle), DTO (Zod), repository (Drizzle query builder), service (business logic), serializer (response shaping), access policy (authorization), use cases (orchestration), controller (Hono routes), and tests (Bun).

## Project Map — Frontend Domains

| Route Group      | Pages    | Features                                                                            |
| ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `(auth)/login`   | login    | LoginPanel (Google + credentials)                                                   |
| `(auth)/consent` | consent  | ConsentDialog in chat                                                               |
| `(app)/advisors` | advisors | AdvisorSelection with showcase visuals                                              |
| `(app)/chat`     | chat     | ChatShell with streaming                                                            |
| `(app)/history`  | history  | ConversationHistory                                                                 |
| `admin`          | admin    | AdminDashboard (usage, limits, telemetry, model-config, advisors, cache, knowledge) |

## Code Style

- No unnecessary comments — patterns are self-documenting
- Standard imports: React / Next → external libs → local modules
- Tailwind v4 with CSS custom properties (OKLCH color space)
- Server code uses `@needle-di/core` for DI
- Frontend uses `@tanstack/react-query` for data fetching
- `prettier` — single quotes, no trailing commas
- `eslint` 9 flat config — zero warnings on commit

## Design System

All styling tokens in `apps/web/src/styles/globals.css` as CSS custom properties:

- **Colors**: `--background`, `--foreground`, `--primary` (`#2d6a4f`), `--ring` (`#d4a373`)
- **Typography**: Inter (sans), Fraunces (serif)
- **Radius**: `--radius: 0.625rem`
- **Dark mode**: `.dark` class via `@custom-variant dark`
- **Tailwind v4 syntax**: `@source`, `@utility`, `not-{breakpoint}:` variants

See `agents/UI-PRACTICES.md` for full principles.
