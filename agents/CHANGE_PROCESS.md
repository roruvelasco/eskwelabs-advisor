# Change Process

> **READ THIS BEFORE MAKING ANY CODE CHANGE.**

## Mandatory Pre-Change Checklist

Before writing any code, construct a plan that addresses all of the following:

### 1. Understand Architecture

- Read [AGENTS.md](../AGENTS.md) for the project map (which domains exist, DI token names, patterns)
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for the full backend/frontend architecture patterns
- Identify the correct files to modify or create based on the domain layout
- Follow the existing pattern exactly: each domain = controller, service, repository, serializer, schema, access-policy, dto, use-cases, tests

### 2. Follow the PRD

> **PRD**: Business requirements in [PRD.md](PRD.md). Implementation guide in [DEVELOPMENT-FLOW.md](DEVELOPMENT-FLOW.md) (grain of salt).

- Every change must align with the product requirements and business rules in the PRD
- Consider all edge cases (see PRD §6.3), not just the happy path
- Handle error states, loading states, empty states, and race conditions

### 3. Respect DI Wiring

- All classes must be registered in `packages/server/src/di/container.ts`
- New domain? Wire its repository → service → serializer → controller → `ApplicationController`
- Cross-cutting deps (env, adapters, rate-limit, cache, cost-cap) use `InjectionToken`
- Repository depends on `DrizzleService`, controller depends on service + serializer + (env)

### 4. Use Existing Factories & Patterns

- Controllers **must** extend `Controller` from `common/factories/controller.factory.ts` — provides `protected controller = new Hono<HonoEnv>()`
- Repositories **must** extend `Repository` from `common/factories/repository.factory.ts` — receives `DrizzleService` via constructor
- Serializers transform domain models into response shape (typically `{ data: ... }`)
- DTOs are Zod schemas for input validation via `parseJsonBody`
- Access policies gate operations per-role/per-ownership

### 5. Backend Pattern: Adding a New Domain

1. Create `packages/server/src/<domain>/` directory
2. Create files in this order:
   - `<domain>.schema.ts` — Drizzle table definition
   - `dto/<domain>.dto.ts` — Zod input/output DTOs
   - `dto/<domain>.filters.dto.ts` — Query filter schemas
   - `<domain>.repository.ts` — extends `Repository`, implements data access
   - `<domain>.service.ts` — business logic, throws `HttpException` on violations
   - `<domain>.serializer.ts` — response shaping
   - `<domain>-access.policy.ts` — authorization rules
   - `use-cases/<domain>-workflow.use-case.ts` — orchestration (if multi-step)
   - `<domain>.controller.ts` — extends `Controller`, registers routes + middleware
   - `tests/<domain>.test.ts` — Bun test coverage
3. Export schema from `packages/server/src/db/drizzle-schema.ts`

   > Never write manual SQL migrations — always use `bun run db:generate` then `bun run db:migrate`.

4. Wire in `packages/server/src/di/container.ts`
5. Register controller routes in `packages/server/src/application.controller.ts`
6. Run `bun run check` (type-check) and `bun test` (unit tests)

### 6. Backend Pattern: Adding a New Route to an Existing Domain

1. Open `<domain>.controller.ts`
2. Add route method (`.get()`, `.post()`, `.put()`, etc.) in the chain
3. Add any new middleware (auth guards, validation)
4. Add Zod validation schema in DTO or inline if simple
5. Implement service method if new business logic needed
6. Add serializer method if new response shape needed
7. Run `bun run check` and `bun test`

### 7. Frontend Pattern: Adding a New Page/Route

1. Create page in `apps/web/src/app/<route-group>/<page>/page.tsx`
2. Create feature component in `apps/web/src/features/<domain>/components/`
3. Create domain API functions in `apps/web/src/lib/domains/<domain>/api.ts`
4. Create query options in `apps/web/src/lib/domains/<domain>/queries.ts`
5. Wire middleware gating in `apps/web/src/middleware.ts` if auth-protected
6. Run `bun run check` and `bun test`

### 8. Error Handling & Edge Cases

Every change must consider:

| Concern        | Pattern                                                               |
| -------------- | --------------------------------------------------------------------- |
| Auth           | `requireActor(roles)`, `requireAllowlistedEifOrAdmin(env)` middleware |
| Ownership      | Service `assertOwns()` pattern in `conversations.service.ts`          |
| Not found      | `throw notFound()` → 404 JSON response                                |
| Forbidden      | `throw forbidden()` → 403 JSON response                               |
| Validation     | `parseJsonBody(c, zodSchema)` → 400 on failure                        |
| Rate limiting  | Automatic via `RateLimitService` on `/api/*`                          |
| Cost cap       | `CostCapEnforcer` checks limits during chat turns                     |
| Inactive users | `auth.middleware.ts` checks `isActive`                                |
| Empty results  | Return `{ data: [] }` not 404                                         |
| Null/undefined | Handle defensively in serializers                                     |

### 9. Testing

- Tests use **Bun test runner** (`bun test` in package directory)
- Tests depend on `^build` in turbo pipeline (`bun run test` runs build first)
- Test files live in `<domain>/tests/<domain>.test.ts`
- For services: unit test business logic with mocked repositories
- For controllers: integration test via Hono's `app.request()` (future)

### 10. Always Gate with Type-Check & Lint

These run **automatically via Git hooks** (Husky v9 + lint-staged):

- **pre-commit**: Prettier format + ESLint `--fix --max-warnings=0` on staged files only (`lint-staged`)
- **pre-push**: `bun run check` (type-check, ~4.5s cold / ~48ms cached) + `bun run test` (Bun tests via Turborepo)

To run manually:

```bash
bun run check   # tsc --noEmit per package (turbo check)
bun run lint    # ESLint 9 flat config (turbo lint)
bun run test    # Bun tests (turbo test, depends on ^build)
```

To skip hooks in an emergency (use sparingly):

```bash
git commit --no-verify
git push --no-verify
```

## Post-Change: Update Docs

After completing a change, update the following if applicable:

| Change Type             | Files to Update                                                         |
| ----------------------- | ----------------------------------------------------------------------- |
| New domain              | AGENTS.md (Backend Domains table), ARCHITECTURE.md (domain inventory)   |
| New DB table            | AGENTS.md (Database Tables), DATABASE.md (table schema + relationships) |
| New env var             | AGENTS.md (Key Env Vars), `turbo.json` (globalPassThroughEnv)           |
| New API route           | API_CONTRACT.md                                                         |
| New frontend page/route | AGENTS.md (Frontend Domains table)                                      |
| New package/dependency  | AGENTS.md (Project Map, Commands)                                       |
| New factory/pattern     | ARCHITECTURE.md                                                         |
| Auth flow change        | AGENTS.md (Auth & CSP), ARCHITECTURE.md (Auth Flow)                     |

## Backend Lifecycle Hooks

```typescript
// packages/server/src/application.module.ts
export class ApplicationModule {
  async start() {
    /* Hook future providers here */
  }
  async stop() {
    /* Close long-lived resources */
  }
}
```

The `createServer()` function in `packages/server/src/index.ts` returns `{ routes, startServer, stopServer }`. For SSR (Vercel), only `routes` is used. The lifecycle hooks are available for long-running runtimes.
