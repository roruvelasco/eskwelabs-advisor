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
│   │       ├── auth/            # AuthService stub
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

3. **Repository** (`<domain>.repository.ts`): Extends `Repository` (which receives `DrizzleService`). Currently uses in-memory Maps; future: Drizzle queries via `this.drizzle.db`.

4. **Service** (`<domain>.service.ts`): Pure business logic. Receives repository(ies) + optional cross-cutting deps (env, cost-cap, etc.). Throws `HttpException` on violations.

5. **Serializer** (`<domain>.serializer.ts`): Transforms domain models for JSON responses. Typically wraps in `{ data: ... }`.

6. **Access Policy** (`<domain>-access.policy.ts`): Authorization rules per action. Used by controllers/services to gate operations.

7. **Use Cases** (`use-cases/<domain>-workflow.use-case.ts`): Multi-step orchestrations that compose services.

8. **Controller** (`<domain>.controller.ts`): Extends `Controller` (base `new Hono<HonoEnv>()`). Registers middleware per-route (auth, validation) and defines route handlers.

### Dependency Injection

- **Container**: `packages/server/src/di/container.ts` — `createContainer()` returns a `Container` from `@needle-di/core`
- **Injection Tokens**: Created for non-class deps (`SERVER_ENV`, `PROMPT_FETCHER`, `DNA_DIGEST_GENERATOR`, `LLM_PROVIDER`)
- **Registration pattern**: `.bind({ provide: XxxService, useFactory: (c) => new XxxService(c.get(XxxRepository)) })`
- **Controller binding**: Controllers get service + serializer + (optionally) env
- **Application wiring**: `ApplicationController` receives all controllers + cross-cutting deps, calls `.registerControllers()` which chains `.basePath('/api')` + routes

### Middleware Stack (order in `application.controller.ts`)

1. `securityHeadersMiddleware` — always applied first
2. `createAuthMiddleware(env)` — resolves actor from request headers
3. `createRateLimitMiddleware(rateLimitService)` — applies to `/api/*`
4. Per-controller middleware — e.g. `requireAllowlistedEifOrAdmin(env)` on domain routes

### Auth Flow

1. Next.js middleware (`apps/web/src/middleware.ts`) resolves actor from cookies, validates against env allowlists, sets `x-eskwelabs-actor-*` headers
2. Hono `auth.middleware.ts` reads those headers and sets `c.set('actor', actor)`
3. Route handlers access via `c.get('actor')`
4. Guard helpers: `requireActor(roles)`, `requireAllowlistedEifOrAdmin(env)`

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
├── (auth)/consent/page.tsx      # ConsentNotice
├── admin/page.tsx               # AdminDashboard
└── api/[[...route]]/route.ts   # Hono catch-all (GET/POST/PUT/PATCH/DELETE)
```

## Frontend Domain Pattern

Each domain in `apps/web/src/lib/domains/<domain>/` has:

| File | Purpose |
|---|---|
| `api.ts` | API functions using `apiClient` (Hono typed client `hc<ApiRoutes>`) |
| `queries.ts` | `@tanstack/react-query` `queryOptions` wrappers |
| `session.ts` | (auth only) Cookie parsing for browser-side session actor |

The `apiClient` is created once in `lib/api/client.ts`:
```ts
const apiClient = hc<ApiRoutes>('/').api;
```

Domain API functions delegate to typed client methods:
```ts
// api.ts
export function listAdvisors() {
  return apiClient.advisors.$get().then(r => r.json());
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

| Package | Contents | Key Exports |
|---|---|---|
| `@eskwelabs-advisor/ui` | Button, Card (CardHeader, CardTitle, CardContent), cn utility | `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `cn` |
| `@eskwelabs-advisor/apps-config` | ESLint 9 flat config | `@eskwelabs-advisor/apps-config/eslint` |
| `@eskwelabs-advisor/typescript-config` | Shared tsconfig presets | `base.json`, `next.json` |

# Key File Paths

| File | Purpose |
|---|---|
| `packages/server/src/index.ts` | `createServer()` entry — returns `{ routes, startServer, stopServer }` |
| `packages/server/src/application.controller.ts` | Registers all domain controllers onto one Hono app |
| `packages/server/src/application.module.ts` | Lifecycle hooks |
| `packages/server/src/di/container.ts` | DI wiring for all classes |
| `packages/server/src/config/env.ts` | `ServerEnv` zod schema |
| `packages/server/src/common/middleware/auth.middleware.ts` | Actor resolution + guards |
| `packages/server/src/common/middleware/error.middleware.ts` | Error → JSON response |
| `packages/server/src/adapters/advisor-adapters.ts` | Deterministic provider stubs |
| `apps/web/src/middleware.ts` | Next.js auth + CSP middleware |
| `apps/web/src/lib/api/client.ts` | Hono typed client singleton |
| `drizzle.config.ts` | Drizzle Kit config (root) |
| `turbo.json` | Task pipeline + global env passthrough |
