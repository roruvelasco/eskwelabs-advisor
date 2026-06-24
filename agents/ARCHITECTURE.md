# Architecture

## Monorepo Layout

```
eskwelabs-advisor/
├── apps/web/                    # Next.js 15 App Router
│   ├── src/
│   │   ├── app/                 # App Router pages & API catch-all
│   │   │   ├── (auth)/          # Login, consent (no layout shell)
│   │   │   ├── (app)/           # Advisors, chat, history (w/ AppShell)
│   │   │   ├── admin/           # Admin dashboard
│   │   │   └── api/[[...route]]/ # Hono catch-all route.ts
│   │   ├── components/          # App-wide components (AppShell, QueryProvider)
│   │   ├── features/            # Feature components (domain-scoped)
│   │   │   ├── admin/components/
│   │   │   ├── advisors/components/
│   │   │   ├── auth/components/
│   │   │   ├── chat/components/
│   │   │   └── conversations/components/
│   │   ├── lib/
│   │   │   ├── api/client.ts    # Hono typed client (hc<ApiRoutes>)
│   │   │   ├── domains/         # Per-domain API + queries
│   │   │   │   ├── http.ts      # getJson / sendJson helpers
│   │   │   │   ├── admin/{api,queries}.ts
│   │   │   │   ├── advisors/{api,queries}.ts
│   │   │   │   ├── auth/{api,session,queries}.ts
│   │   │   │   ├── chat/{api,queries}.ts
│   │   │   │   └── conversations/{api,queries}.ts
│   │   │   └── supabase/        # Stub Supabase clients (return null)
│   │   ├── styles/globals.css   # Tailwind v4 entry
│   │   └── middleware.ts        # Auth, CSP, route gating
│   └── next.config.ts           # transpilePackages: server, ui
│
├── packages/
│   ├── server/                  # Hono 4 API (source, not built)
│   │   └── src/
│   │       ├── <domain>/        # Per-domain module (see below)
│   │       ├── common/
│   │       │   ├── factories/   # Controller, Repository base classes
│   │       │   ├── http/        # HttpException + factories
│   │       │   ├── middleware/   # auth, error, rate-limit, security, validation
│   │       │   └── utils/       # HonoEnv type, client-ip, day-ph helpers
│   │       ├── adapters/        # Deterministic LLM adapters (stubs)
│   │       ├── auth/            # AuthService DB-backed actor resolution
│   │       ├── cache/           # RedisService
│   │       ├── config/          # ServerEnv zod schema
│   │       ├── db/              # DrizzleService, drizzle-schema (re-exports)
│   │       ├── di/              # DI container wiring
│   │       ├── rate-limit/      # RateLimitService
│   │       ├── application.controller.ts  # Registers all routes
│   │       └── application.module.ts      # Lifecycle hooks
│   │
│   ├── ui/                      # Shared React components
│   │   └── src/
│   │       ├── components/ui/   # Button, Card (shadcn-style)
│   │       └── utils/cn.ts      # clsx + twMerge
│   │
│   ├── apps-config/             # ESLint 9 flat config
│   └── typescript-config/       # base.json, next.json
│
├── agents/                      # Supplementary docs (this directory)
└── scripts/                     # Helper scripts (README only)
```

# Backend Architecture

## Domain Module Pattern

Every backend domain at `packages/server/src/<domain>/` follows the same layout:

```
<domain>/
├── <domain>.schema.ts           # Drizzle table definition
├── dto/
│   ├── <domain>.dto.ts          # Zod input/output schemas
│   └── <domain>.filters.dto.ts  # Query filter schemas
├── <domain>.repository.ts       # Data access (extends Repository)
├── <domain>.service.ts          # Business logic
├── <domain>.serializer.ts       # Response shaping
├── <domain>-access.policy.ts    # Authorization rules
├── use-cases/
│   └── <domain>-workflow.use-case.ts  # Orchestration
├── tests/
│   └── <domain>.test.ts         # Bun tests
└── <domain>.controller.ts       # Hono routes (extends Controller)
```

### Layer Responsibilities

1. **Schema** (`<domain>.schema.ts`): Drizzle `pgTable` definition with snake_case columns. Exported as `*Table` + `*` type. Re-exported via `db/drizzle-schema.ts`.

2. **DTO** (`dto/<domain>.dto.ts`): Zod schemas for input validation (`parseJsonBody`) and type definitions for typed responses.

3. **Repository** (`<domain>.repository.ts`): Extends `Repository` (which receives `DrizzleService`). Uses `this.drizzle.db` for table-backed domains; some incomplete MVP domains still use deterministic in-memory stubs.

4. **Service** (`<domain>.service.ts`): Pure business logic. Receives repository(ies) + optional cross-cutting deps (env, cost-cap, etc.). Throws `HttpException` on violations.

5. **Serializer** (`<domain>.serializer.ts`): Transforms domain models for JSON responses. Typically wraps in `{ data: ... }`.

6. **Access Policy** (`<domain>-access.policy.ts`): Authorization rules per action. Used by controllers/services to gate operations.

7. **Use Cases** (`use-cases/<domain>-workflow.use-case.ts`): Multi-step orchestrations that compose services.

8. **Controller** (`<domain>.controller.ts`): Extends `Controller` (base `new Hono<HonoEnv>()`). Registers middleware per-route (auth, validation) and defines route handlers.

### Dependency Injection

- **Container**: `packages/server/src/di/container.ts` — `createContainer()` returns a `Container` from `@needle-di/core`
- **Injection Tokens**: Created for non-class deps (`SERVER_ENV`, `DNA_DIGEST_SUMMARIZER`, `PROMPT_CONTEXT_LOADER`, `KNOWLEDGE_CONTEXT_RESOLVER`, `LLM_PROVIDER`, `EMBEDDING_PROVIDER`, `KNOWLEDGE_INDEX_PROVIDER`)
- **Registration pattern**: `.bind({ provide: XxxService, useFactory: (c) => new XxxService(c.get(XxxRepository)) })`
- **Controller binding**: Controllers get service + serializer + (optionally) env
- **Application wiring**: `ApplicationController` receives all controllers + cross-cutting deps, calls `.registerControllers()` which chains `.basePath('/api')` + routes

### Prompt Context Flow

- Google Docs remains the prompt/DNA authoring source of truth.
- `PromptIngestionService` runs from admin refresh/rollback paths and scheduled cron: it reads Google Docs, hashes raw DNA before summarization, stores durable active rows in `prompt_snapshots` and `dna_digests`, and warms Redis.
- `PromptCacheService.refresh()` accepts a `source: 'admin' | 'cron'` parameter; telemetry event names use `${source}_cache_refresh` (or `_failed`) to distinguish admin-initiated vs. cron-initiated refreshes.
- `PromptCacheJobsController` exposes `GET /api/internal/jobs/prompt-cache/refresh` for cron execution, protected by `Authorization: Bearer <CRON_SECRET>`.
- `PromptContextService` serves chat turns from Redis first, then active Postgres snapshots. If no active snapshot exists, chat fails safely with `prompt_context_unavailable`; it never fetches Google Docs or calls the summarizer.
- `MessagesService.prepareTurn()` receives compiled-ready context via `PROMPT_CONTEXT_LOADER`, builds the LLM request, and records the prompt snapshot hash and DNA digest hash used for the turn.

### Knowledge Context Flow

- The `knowledge` domain is the post-MVP path for source-backed factual grounding without growing the always-on advisor prompt.
- `KnowledgeIngestionService` ingests registered Google Doc sources into versioned `knowledge_units`; source text remains server-side and admin endpoints return metadata only. After ingestion, units are indexed via `KNOWLEDGE_INDEX_PROVIDER` (`PostgresKnowledgeIndexProvider`) which generates Groq embeddings and stores them in pgvector with denormalized retrieval metadata (status, advisor_scope, content_type, etc.) copied from the unit for same-table HNSW filtering.
- `KNOWLEDGE_CONTEXT_RESOLVER` selects query-specific evidence during `MessagesService.prepareTurn()`. Mentoring and clarification turns skip retrieval; factual policy turns prefer `knowledge_rules`; all other modes use semantic vector search (cosine similarity, threshold < 0.3) via `EMBEDDING_PROVIDER`.
- Vector search uses a materialized CTE (`WITH candidates AS MATERIALIZED`) that queries `knowledge_embeddings` directly with same-table filters (partial HNSW index scoped to `status = 'published'`), splits global/advisor scope into UNION ALL branches for index usage, over-fetches candidates (`max(limit * 10, 50)`), sets `SET LOCAL hnsw.ef_search = 100` and `hnsw.iterative_scan = strict_order` inside the retrieval transaction, then joins to `knowledge_units` only after candidate selection.
- `BoundedKnowledgeContextResolver` (decorator) wraps `RepositoryKnowledgeContextResolver` with fail-open resilience:
  - **Context cache**: 5-minute Redis TTL on resolved context (keyed by advisor, answer mode, query hash), decoupled from ingestion (eventual consistency via TTL only).
  - **Circuit breaker**: opens after 3 semantic failures within 5 minutes, resets after 60 seconds; isolates chat-time failures from the indexing path.
  - **Bounded budget**: semantic resolution has a 350ms deadline (`KNOWLEDGE_SEMANTIC_SYNC_BUDGET_MS` via `Promise.race`); on timeout, falls back to lexical FTS search (`searchPublishedUnits` + `findPublishedRules`) with `strategy: 'lexical'`, then schedules an async cache-warm via `DeferredTaskRunner`.
  - **Embedding cache**: `CachedEmbeddingProvider` wraps the raw `GroqEmbeddingProvider` with Redis persistence (7-day TTL, `embed:{provider}:{model}:{hash}`), in-flight request coalescing, and memory-safe `.finally()` cleanup.
  - **Embedding timeout**: `GroqEmbeddingProvider` applies `EMBEDDING_PROVIDER_TIMEOUT_MS` (default 5000ms) as a hard safety-net abort on all fetch calls.
- Selected evidence is injected as a bounded `<selected_knowledge_context>` section, while the advisor prompt and DNA remain behavioral runtime context.
- Assistant messages record aggregate knowledge metadata, and `message_knowledge_audit` records selected unit/rule IDs, source revisions, hashes, rank, score, and resolver strategy.
- `EMBEDDING_PROVIDER` (`GroqEmbeddingProvider` using `nomic-embed-text-v1.5`, 768d) generates dense vectors for semantic retrieval. Embedding failures fail closed (empty context), but the bounded resolver's lexical fallback ensures the user still gets FTS-driven results.
- `replaceUnitsForSourceRevision()` deletes old source embeddings in the same transaction that retires units, preventing stale published vectors in the partial HNSW index.

### Conversation Title Flow

- `SuccessfulTurnPersistenceService` enqueues one `conversation_title_jobs` row after a successful chat turn when the conversation still needs a generated title.
- `ConversationTitleJobsRepository` claims pending/stale jobs with lease fields so multiple workers can drain safely without double-processing the same conversation.
- `ConversationTitleWorker` resolves the runtime model, generates and normalizes a short title, updates the conversation title/source, and records completion/failure telemetry.
- `ConversationTitleJobsController` exposes `GET /api/internal/jobs/conversation-titles/drain` for cron/worker execution. It is protected by `Authorization: Bearer <CRON_SECRET>`, not actor session auth.

### Middleware Stack (order in `application.controller.ts`)

1. `securityHeadersMiddleware` — always applied first
2. `createAuthMiddleware(usersService)` — validates forwarded actor id/email against the `users` table and resolves DB role/status
3. `createRateLimitMiddleware(rateLimitService)` — applies to `/api/*`
4. Per-controller middleware — e.g. `requireActor(['eif', 'admin'])` on protected domain routes

### Auth Flow

1. NextAuth sign-in resolves Google email against the Supabase/Postgres `users` table via `AuthService`; missing/inactive users are rejected.
2. Login intent is role-specific at the provider layer: `/login` uses `google` / `credentials`, while `/admin/login` uses `google-admin` / `credentials-admin`. Both account types resolve through the `users` allow-list, and the sign-in callback rejects role mismatches before creating a JWT session.
3. Next.js middleware (`apps/web/src/middleware.ts`) reads JWT claims, gates routes by `role`/`isActive`, signs forwarded actor headers with HMAC-SHA256 (`ACTOR_FORWARDING_SECRET`) including method, path, timestamp, and nonce, then forwards `x-eskwelabs-actor-*` and signature headers.
4. Admin and EIF app areas are strictly separated: wrong-role page requests redirect to that role's home, and wrong-role API requests return 403.
5. Hono `auth.middleware.ts` verifies the HMAC signature and timestamp freshness (300s TTL) before trusting forwarded actor headers. Then validates id/email against the `users` table and sets `c.set('actor', actor)` from DB role/status.
6. Route handlers access via `c.get('actor')`.
7. Guard helper: `requireActor(roles)`.
8. Client session: `/api/session` verifies the NextAuth JWT server-side and returns `{ data: SessionActor | null }`. This handles client-side session queries without reading httpOnly cookies.

### Error Handling

- `HttpException` class with `status`, `code`, `message`, `safeDetails` (packages/server/src/common/http/http-exception.ts)
- Factory functions: `forbidden()`, `unauthorized()`, `notFound()`, `rateLimited()`, `validationFailed()`
- `error.middleware.ts` catches `HttpException` and returns structured JSON `{ error: { code, message, details } }`
- Non-HttpException errors → 500 with generic message, logged via `console.error`

# Frontend Architecture

## App Router Structure

```
apps/web/src/app/
├── layout.tsx                   # Root layout (await headers() for CSP)
├── page.tsx                     # Landing page
├── (app)/layout.tsx             # AppShell wrapper for authenticated routes
├── (app)/advisors/page.tsx     # AdvisorSelection
├── (app)/chat/page.tsx          # ChatShell
├── (app)/history/page.tsx       # ConversationHistory
├── (auth)/login/page.tsx        # LoginPanel
├── (auth)/consent/page.tsx      # redirects; active notice is chat ConsentDialog
├── admin/page.tsx               # AdminDashboard
└── api/[[...route]]/route.ts   # Hono catch-all (GET/POST/PUT/PATCH/DELETE)
```

## Frontend Domain Pattern

Each domain in `apps/web/src/lib/domains/<domain>/` has:

| File         | Purpose                                                             |
| ------------ | ------------------------------------------------------------------- |
| `api.ts`     | API functions using `apiClient` (Hono typed client `hc<ApiRoutes>`) |
| `queries.ts` | `@tanstack/react-query` `queryOptions` wrappers                     |
| `session.ts` | (auth only) Cookie parsing for browser-side session actor           |

The `apiClient` is created once in `lib/api/client.ts`:

```ts
const apiClient = hc<ApiRoutes>('/').api;
```

Domain API functions delegate to typed client methods:

```ts
// api.ts
export function listAdvisors() {
  return apiClient.advisors.$get().then((r) => r.json());
}
```

Query options wrap API functions:

```ts
// queries.ts
export const advisorsQuery = queryOptions({
  queryKey: ['advisors'],
  queryFn: listAdvisors
});
```

## Component Architecture

- **Feature components** live in `apps/web/src/features/<domain>/components/`
- **App-wide components** live in `apps/web/src/components/`
- **Shadcn-style UI primitives** live in `packages/ui/src/components/ui/`
- Components use `@tanstack/react-query` via `QueryProvider` (wrapped in root layout)
- CSP nonce is handled server-side by `middleware.ts` and root layout `await headers()`

# Shared Packages

| Package                                | Contents                                                      | Key Exports                                                      |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `@eskwelabs-advisor/ui`                | Button, Card (CardHeader, CardTitle, CardContent), cn utility | `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `cn` |
| `@eskwelabs-advisor/apps-config`       | ESLint 9 flat config                                          | `@eskwelabs-advisor/apps-config/eslint`                          |
| `@eskwelabs-advisor/typescript-config` | Shared tsconfig presets                                       | `base.json`, `next.json`                                         |

# Key File Paths

| File                                                        | Purpose                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/server/src/index.ts`                              | `createServer()` entry — returns `{ routes, startServer, stopServer }` |
| `packages/server/src/application.controller.ts`             | Registers all domain controllers onto one Hono app                     |
| `packages/server/src/application.module.ts`                 | Lifecycle hooks                                                        |
| `packages/server/src/di/container.ts`                       | DI wiring for all classes                                              |
| `packages/server/src/config/env.ts`                         | `ServerEnv` zod schema                                                 |
| `packages/server/src/common/middleware/auth.middleware.ts`  | Actor resolution + guards                                              |
| `packages/server/src/common/middleware/error.middleware.ts` | Error → JSON response                                                  |
| `packages/server/src/adapters/advisor-adapters.ts`          | Deterministic provider stubs                                           |
| `apps/web/src/middleware.ts`                                | Next.js auth + CSP middleware                                          |
| `apps/web/src/lib/api/client.ts`                            | Hono typed client singleton                                            |
| `drizzle.config.ts`                                         | Drizzle Kit config (root)                                              |
| `turbo.json`                                                | Task pipeline + global env passthrough                                 |
