## 3. High Priority Findings

### H1. No Pagination on Core List Endpoints

- Category: Performance / Scalability
- Files: conversations.repository.ts, messages.repository.ts, telemetry.repository.ts, usage-counters.repository.ts, users.repository.ts, prompt-cache.repository.ts
- Evidence: Every list() method returns all rows with no LIMIT/OFFSET. The telemetry table grows fastest (every turn generates 2-5 events).
- Impact: The PRD targets ~100 concurrent EIFs. Without pagination, list endpoints will degrade rapidly.
- Remediation: Add cursor-based or offset pagination to all list endpoints. Prioritize telemetry and conversations.

### H2. No Database Indexes on Primary Query Patterns

- Category: Performance / Database Design
- Files: packages/server/drizzle/ (migrations), schema files
- Evidence: Missing indexes on:
  - conversations(user_id, created_at DESC) — the most common query pattern
  - messages(conversation_id, created_at ASC) — loading conversation history
  - telemetry_events(created_at DESC) — admin dashboard
  - telemetry_events(event_name) — filtering
  - advisor_runtime_versions(advisor_id) — runtime resolution
- Impact: Full table scans on the most frequent queries. Performance degrades linearly with data volume.
- Remediation: Create a migration adding indexes for all primary query patterns.

### H3. Full Message History Loaded for Every Chat Turn

- Category: Performance
- Files: packages/server/src/messages/messages.service.ts:213
- Evidence: prepareTurn calls listForConversation which fetches ALL messages, then filters and slices to the last 20 in JavaScript.
- Impact: Long conversations (100+ turns) load hundreds of messages from the database just to use the last 20.
- Remediation: Add a LIMIT 20 ORDER BY created_at DESC at the SQL level.

### H4. Gemini Provider Has No Timeout

- Category: Reliability / Bug
- Files: packages/server/src/adapters/advisor-adapters.ts (GeminiLlmProvider)
- Evidence: Unlike GroqLlmProvider which uses AbortController with PROVIDER_TIMEOUT_MS, the Gemini provider has no timeout on either complete() or stream(). A hung Gemini connection blocks indefinitely.
- Impact: Serverless function timeout (Vercel default 10s) will kill the request, but the user sees no graceful error.
- Remediation: Add AbortController with timeout to both Gemini methods, matching the Groq pattern.

### H5. Non-Atomic Rate Limiting in Memory-Fallback Mode

- Category: Security / Bug
- Files: packages/server/src/cache/redis.service.ts:95-98
- Evidence: incrWithTtl does get then set as separate operations in the in-memory fallback. Under concurrent requests, two callers can both read 0 and both set 1, losing an increment.
- Impact: Rate limiting is unreliable when Redis is not configured. Multiple requests can bypass the limit simultaneously.
- Remediation: Use a mutex or atomic counter for the in-memory fallback.

### H6. No Error Boundaries in Frontend

- Category: UX / Reliability
- Files: apps/web/src/app/ (all route groups)
- Evidence: No error.tsx, global-error.tsx, loading.tsx, or not-found.tsx files exist anywhere in the app directory tree.
- Impact: Any unhandled error shows Next.js's default error page with no branded recovery UI, no retry option, and no user-friendly messaging. Violates FR-12 (graceful errors).
- Remediation: Add error.tsx at root, (app), (auth), and admin route groups. Add loading.tsx for route-level suspense.

### H7. No Abort Controller for SSE Streams

- Category: UX / Reliability
- Files: apps/web/src/lib/domains/chat/api.ts, apps/web/src/features/chat/components/new-chat-shell.tsx
- Evidence: streamChatTurn has no AbortController. Users cannot cancel a stream mid-generation. If the server hangs, the client waits indefinitely.
- Impact: Users stuck waiting for unresponsive streams with no cancel button. Violates FR-12 (graceful errors).
- Remediation: Add AbortController to the stream fetch, expose a cancel button in the UI.

### H8. Missing Foreign Key Constraints

- Category: Database Design / Data Integrity
- Files: advisors/advisors.schema.ts, conversations/conversations.schema.ts
- Evidence: advisors.active_runtime_version_id and conversations.advisor_runtime_version_id semantically reference advisor_runtime_versions.id but have no FK constraint. Dangling references are possible.
- Impact: Data integrity violations. Deleting a runtime version leaves orphaned references.
- Remediation: Add FK constraints in a migration.

### H11. Undocumented conversation-titles Domain

- Category: Documentation / Maintainability
- Files: packages/server/src/conversation-titles/ (9 files)
- Evidence: A full domain (controller, worker, generator, normalizer, repository, schema) exists in code but is absent from ARCHITECTURE.md, API_CONTRACT.md, DATABASE.md, and AGENTS.md.
- Impact: New developers cannot discover or understand this domain from documentation.
- Remediation: Document the domain in all four agent docs.

### H12. RUNTIME_PROFILE Defaults to 'demo'

- Category: Security / Configuration
- Files: packages/server/src/config/env.ts
- Evidence: If RUNTIME_PROFILE is not set, the app runs in demo mode. This enables DeterministicLlmProvider (hardcoded responses) and affects SSL detection.
- Impact: Production deployment without explicit RUNTIME_PROFILE=production will run with stub LLM responses and potentially incorrect SSL settings.
- Remediation: Change default to 'production' or make it required.

## 4. Medium/Low Priority Findings

### M1. Redis KEYS Command in delByPrefix

- Category: Performance
- Files: packages/server/src/cache/redis.service.ts:72
- Evidence: Uses KEYS pattern which is O(N) and blocks Redis. Should use SCAN.

### M2. No Rate-Limit Response Headers

- Category: Developer Experience
- Files: packages/server/src/common/middleware/rate-limit.middleware.ts
- Evidence: Clients have no visibility into rate-limit status until they get a 429. No X-RateLimit-\* headers.

### M3. No Brute-Force Protection on Credential Login

- Category: Security
- Files: packages/server/src/auth/auth.service.ts
- Evidence: No account lockout or rate-limiting on failed password attempts at the service level.

### M4. Gemini API Key in URL Query Parameter

- Category: Security
- Files: packages/server/src/adapters/advisor-adapters.ts:181,275
- Evidence: ?key=${apiKey} can appear in server logs, proxy logs, and browser history.

### M5. PromptCacheService.refresh() Doesn't Cache in Redis

- Category: Bug
- Files: packages/server/src/prompt-cache/prompt-cache.service.ts
- Evidence: refresh() writes to the prompt_cache DB table but never calls cachePrompt/cacheDna to populate Redis.

### M6. DrizzleService Never Closes Connection

- Category: Resource Leak
- Files: packages/server/src/db/drizzle.service.ts, application.module.ts
- Evidence: ApplicationModule.stop() is a no-op. Postgres connection is never closed.

### M7. Verbose Auth Logging in Production

- Category: Security / Information Leakage
- Files: apps/web/src/middleware.ts:284-303, apps/web/src/lib/domains/auth/token-actor.ts:26-52
- Evidence: Logs cookie names, token shape, and secret equality to console.info.

### M8. Floating-Point Spend Arithmetic

- Category: Correctness
- Files: packages/server/src/usage-counters/usage-counters.repository.ts
- Evidence: estimatedSpendTodayUsd stored as numeric (string) but arithmetic uses Number() conversion. Floating-point precision issues possible.

### M9. Inconsistent ON DELETE Behavior

- Category: Database Design
- Evidence: messages.conversation_id cascades but messages.user_id does not. Deleting a user with conversations fails. No consistent deletion policy.

### M10. No CHECK Constraints on Enum-Like Columns

- Category: Database Design
- Evidence: users.role, messages.role, messages.status, conversations.status, telemetry_events.severity are all text with no DB-level CHECK constraint.

### M11. createOrReactivate Not Atomic

- Category: Bug / Race Condition
- Files: packages/server/src/users/users.service.ts
- Evidence: findByEmail then update/insert as separate queries. Race condition on concurrent user creation.

### M12. Migration 0007 Has Destructive Guard

- Category: Deployment Risk
- Files: packages/server/drizzle/0007_aromatic_toad.sql
- Evidence: Raises exception if conversation_title_jobs has any rows. Will block migration in any environment running title generation.

### M13. Supabase enable_signup = true

- Category: Security / Configuration
- Files: supabase/config.toml
- Evidence: Open signups allow Supabase Auth accounts without corresponding users rows, bypassing the allowlist.

### M14. Default DB Credentials in 7 Files

- Category: Configuration / Maintainability
- Evidence: postgresql://postgres:postgres@127.0.0.1:54322/postgres hardcoded in drizzle.config.ts, drizzle.service.ts, env.ts, nuke-db.ts, seed.ts, sync-advisors.ts, publish-advisor.ts.

### M15. GOOGLE_GENERATIVE_AI_API_KEY Missing from Env Schema

- Category: Configuration
- Files: packages/server/src/config/env.ts
- Evidence: Present in turbo.json and .env.example but not in the Zod validation schema.

### M16. useMediaQuery SSR Hydration Risk

- Category: Frontend / Bug
- Files: packages/ui/src/hooks/use-media-query.ts
- Evidence: useState(false) initial value causes hydration mismatch in SSR.

### M17. Sort Headers Are Non-Functional (All Admin Tables)

- Category: UX
- Files: All admin panel components
- Evidence: ChevronsUpDown icon shown but no onClick handler. Decorative only.

### M18. Chat Auto-Scroll Cannot Be Paused

- Category: UX
- Files: apps/web/src/features/chat/components/chat-messages.tsx
- Evidence: New messages force-scroll to bottom even if user scrolled up to read earlier messages.

## 5. Frontend and UX Review

### Accessibility (WCAG)

| Concern                         | Status  | Impact                                          |
| ------------------------------- | ------- | ----------------------------------------------- |
| Skip-to-content link            | Missing | Keyboard users must tab through entire nav      |
| aria-live on chat messages      | Missing | Screen readers don't announce new messages      |
| aria-describedby on form errors | Missing | Screen readers don't announce validation errors |
| role="log" on message container | Missing | Chat not identified as live region              |
| Loading indicators lack ARIA    | Missing | DotWave/Skeleton invisible to assistive tech    |
| Focus management in dialogs     | OK      | Radix-based                                     |
| Reduced motion                  | OK      | prefers-reduced-motion properly handled         |
| Color contrast                  | OK      | Design tokens provide adequate contrast         |

### Responsiveness

- Advisor grid: 1→2→3 columns (mobile→tablet→desktop) — Good
- Chat sidebar: Sheet on mobile, dropdown on desktop — Good
- Admin dashboard: Stacked on mobile, sidebar on desktop — Good
- Long-press delete on mobile is undiscoverable (no visual hint)
- Chat composer send button (32px) may be too small for mobile touch targets

### UX Flow Issues

| Flow                                         | Issue                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Login → Consent → Advisors                   | Consent page redirects away; consent handled via dialog in advisor-selection instead. ConsentNotice component is dead code. |
| Chat → Cancel stream                         | Not possible — no abort controller                                                                                          |
| Chat → Retry failed message                  | Not possible — no retry button                                                                                              |
| Chat → Read earlier messages while streaming | Broken — auto-scroll forces to bottom                                                                                       |
| History → Search conversations               | Not possible — no search                                                                                                    |
| History → Delete conversation                | Not possible from this page (only in chat sidebar)                                                                          |
| Admin → Persist section state on refresh     | Broken — section stored in useState, not URL                                                                                |
| Admin → Sort tables                          | Broken — sort icons are decorative                                                                                          |

### Dead Code (Frontend)

| File                                         | Status                      |
| -------------------------------------------- | --------------------------- |
| components/app-shell.tsx                     | Not imported anywhere       |
| features/auth/components/consent-notice.tsx  | Consent page redirects away |
| features/chat/components/chat-mode-chips.tsx | Not imported anywhere       |
| lib/api/api-error.ts (parseApiResponse)      | Unused by any domain API    |
| lib/domains/http.ts (getJson/sendJson)       | Unused by any domain API    |
| lib/supabase/client.ts / server.ts           | Stubs returning null        |

## 6. Architecture and Technical Debt Review

### Strengths

- Clean domain-driven architecture with consistent file structure per domain
- DI container (@needle-di/core) with proper injection tokens
- Typed API client (hc<ApiRoutes>) provides end-to-end type safety
- Structured error handling with HttpException and factory functions
- Advisory locks prevent concurrent usage update races
- Three-tier prompt loading (Redis → Google Docs → Postgres fallback)
- Job queue for title generation with lease-based concurrency and crash recovery

### Technical Debt

| Category                   | Items                                                                           | Effort                         |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Dead access policies       | All 8 \*AccessPolicy classes return true unconditionally                        | Low — delete or implement      |
| Dead workflow use-cases    | All 8 \*WorkflowUseCase classes return { status: 'stub' }                       | Low — delete or implement      |
| Serializer pass-throughs   | Most serializers accept unknown[] and pass through without filtering            | Medium — add field selection   |
| In-memory repositories     | Most repos still use in-memory Maps (only UsersRepository migrated to Drizzle)  | High — complete migration      |
| Dual HTTP helpers          | api-error.ts and http.ts are unused alongside the Hono typed client             | Low — delete                   |
| Radix import inconsistency | Badge imports from 'radix-ui', Button from '@radix-ui/react-slot'               | Low — standardize              |
| Login panel duplication    | login-panel.tsx and admin-login-panel.tsx are ~255 lines of near-identical code | Low — extract shared component |
| Hardcoded colors           | 10+ instances of hardcoded hex colors instead of CSS custom properties          | Medium — replace with tokens   |

### Database Architecture Concerns

- No soft-delete pattern — tables use is_active booleans inconsistently
- No updated_at triggers — application code must remember to set timestamps
- RLS only on 3 of 12 tables — users, conversations, messages have RLS; the other 9 do not
- No archival/partitioning strategy for telemetry_events — will grow unbounded
- Seed data in migrations (0000) — mixes DDL with seed data

## 7. PRD Compliance Report

### Functional Requirements

| ID    | Requirement                               | Status          | Evidence                                                                                                                                                                                                         |
| ----- | ----------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Google OAuth2 login with allow-list       | Partial         | OAuth works, allow-list enforced via users table. But credentials login also exists (not in PRD). No clear "access denied" message for non-allow-listed users — they get generic NextAuth error.                 |
| FR-02 | Advisor selection + multi-turn chat       | Partial         | Advisor selection works. Chat works with streaming. But no conversation resume from history into chat (FR-15).                                                                                                   |
| FR-03 | System prompts + DNA injected server-side | Implemented     | CompiledSystemPromptBuilder assembles DNA + prompt server-side. Tests verify no leakage.                                                                                                                         |
| FR-04 | Prompts fetched live from Google Docs     | Partial         | GoogleDocsClient exists with OAuth2 and caching. But PromptCacheService.refresh() doesn't populate Redis (M5). Deterministic stubs used when RUNTIME_PROFILE=demo.                                               |
| FR-05 | Every turn persisted                      | Implemented     | messages table with full metadata. Tests verify persistence.                                                                                                                                                     |
| FR-06 | Hard caps on usage and spend              | Implemented     | CostCapEnforcer checks message, token, and spend caps. PH calendar day reset. Tests verify blocking.                                                                                                             |
| FR-07 | Rate limiting                             | Partial         | Rate limiter exists but non-atomic in fallback mode (H5). No per-route granularity. No response headers (M2).                                                                                                    |
| FR-08 | Model config per advisor                  | Implemented     | ModelConfigController + ModelConfigService with admin-only access. Applied at call time.                                                                                                                         |
| FR-09 | Admin usage/cost views                    | Partial         | Admin dashboard exists with usage panel. But admin overview loads all rows (C4). No date range filters. No export.                                                                                               |
| FR-10 | Streamed responses                        | Implemented     | SSE streaming with token-by-token delivery. MessageResponse uses Streamdown for animated rendering.                                                                                                              |
| FR-11 | Logging consent notice                    | Partial         | Consent dialog exists in advisor-selection.tsx. But ConsentNotice component is dead code. Consent API integration unclear.                                                                                       |
| FR-12 | Graceful errors                           | Not implemented | No error.tsx files (H6). No retry buttons. No cancel stream (H7). Chat error state shows "Request failed" with no recovery.                                                                                      |
| FR-13 | Manual cache refresh                      | Implemented     | PromptCacheController has refresh endpoint. Admin UI has refresh dialog with confirmation.                                                                                                                       |
| FR-14 | Shared DNA grounding                      | Partial         | DnaDigestsRepository + CompiledSystemPromptBuilder exist. But digest generation depends on DeterministicPromptContextService in demo mode. No real summarization pipeline visible.                               |
| FR-15 | See and resume past conversations         | Partial         | History page lists conversations. But clicking a conversation navigates to chat with conversationId — the resume flow depends on loading prior messages, which works. However, no pagination (H1) and no search. |

### Non-Functional Requirements

| NFR                                 | Status       | Evidence                                                                                                |
| ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Latency (p95 first-token ≤ 3s)      | Untested     | No performance benchmarks. Streaming masks total time.                                                  |
| Security (0 client exposures)       | At risk      | Password hash leakage (C2). Session always null (C3). Header forgery (C1).                              |
| RLS isolation                       | Partial      | RLS on 3 tables. No RLS tests visible.                                                                  |
| Observability (all events logged)   | Partial      | Telemetry service exists. Events are recorded. But no structured log format, no request ID correlation. |
| Accessibility (WCAG-aware defaults) | Below target | Multiple ARIA gaps identified in §5.                                                                    |
| Scalability (~100 concurrent EIFs)  | At risk      | No pagination (H1), no indexes (H2), full history loading (H3), admin overview loads all rows (C4).     |

### Telemetry Events (PRD §8)

| Event                  | Implemented?                              |
| ---------------------- | ----------------------------------------- |
| login_success          | Not visible in code                       |
| login_denied           | Not visible in code                       |
| advisor_selected       | Not visible in code                       |
| conversation_resumed   | Not visible in code                       |
| message_sent           | Partial (telemetry recorded in chat turn) |
| llm_call_started       | Recorded                                  |
| llm_call_completed     | Recorded                                  |
| request_blocked        | Recorded                                  |
| prompt_cache_hit       | Not visible                               |
| prompt_cache_miss      | Not visible                               |
| dna_digest_regenerated | Not visible                               |
| doc_fetch_error        | Recorded                                  |
| provider_error         | Recorded                                  |
| supabase_write_error   | Not visible                               |
| admin_model_changed    | Not visible                               |
| admin_cache_refresh    | Not visible                               |

Compliance: ~7 of 16 events are clearly recorded
