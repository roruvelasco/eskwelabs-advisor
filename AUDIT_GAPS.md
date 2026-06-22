## 3. High Priority Findings

## 4. Medium/Low Priority Findings

### M13. Supabase enable_signup = true

- Category: Security / Configuration
- Files: supabase/config.toml
- Evidence: Open signups allow Supabase Auth accounts without corresponding users rows, bypassing the allowlist.

### M14. Default DB Credentials in 7 Files

- Category: Configuration / Maintainability
- Evidence: postgresql://postgres:postgres@127.0.0.1:54322/postgres hardcoded in drizzle.config.ts, drizzle.service.ts, env.ts, nuke-db.ts, seed.ts, sync-advisors.ts, publish-advisor.ts.

### M16. useMediaQuery SSR Hydration Risk

- Category: Frontend / Bug
- Files: packages/ui/src/hooks/use-media-query.ts
- Evidence: useState(false) initial value causes hydration mismatch in SSR.

### M17. Sort Headers Are Non-Functional (All Admin Tables)

- Category: UX
- Files: All admin panel components
- Evidence: ChevronsUpDown icon shown but no onClick handler. Decorative only.

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
| Chat → Cancel stream                         | Implemented — AbortController in new-chat-shell.tsx                                                                         |
| Chat → Retry failed message                  | Implemented — retry button in chat-messages.tsx                                                                             |
| Chat → Read earlier messages while streaming | Fixed — isNearBottom tracking pauses auto-scroll when user scrolls up                                                       |
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

| ID    | Requirement                               | Status      | Evidence                                                                                                                                                                                                               |
| ----- | ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Google OAuth2 login with allow-list       | Partial     | OAuth works, allow-list enforced via users table. But credentials login also exists (not in PRD). No clear "access denied" message for non-allow-listed users — they get generic NextAuth error.                       |
| FR-02 | Advisor selection + multi-turn chat       | Partial     | Advisor selection works. Chat works with streaming. But no conversation resume from history into chat (FR-15).                                                                                                         |
| FR-03 | System prompts + DNA injected server-side | Implemented | CompiledSystemPromptBuilder assembles DNA + prompt server-side. Tests verify no leakage.                                                                                                                               |
| FR-04 | Prompts fetched live from Google Docs     | Partial     | GoogleDocsClient exists with OAuth2 and caching. But PromptCacheService.refresh() doesn't populate Redis (M5). Deterministic stubs used when RUNTIME_PROFILE=demo.                                                     |
| FR-05 | Every turn persisted                      | Implemented | messages table with full metadata. Tests verify persistence.                                                                                                                                                           |
| FR-06 | Hard caps on usage and spend              | Implemented | CostCapEnforcer checks message, token, and spend caps. PH calendar day reset. Tests verify blocking.                                                                                                                   |
| FR-07 | Rate limiting                             | Partial     | Rate limiter exists but non-atomic in fallback mode (H5). No per-route granularity. No response headers (M2).                                                                                                          |
| FR-08 | Model config per advisor                  | Implemented | ModelConfigController + ModelConfigService with admin-only access. Applied at call time.                                                                                                                               |
| FR-09 | Admin usage/cost views                    | Partial     | Admin dashboard exists with usage panel. But admin overview loads all rows (C4). No date range filters. No export.                                                                                                     |
| FR-10 | Streamed responses                        | Implemented | SSE streaming with token-by-token delivery. MessageResponse uses Streamdown for animated rendering.                                                                                                                    |
| FR-11 | Logging consent notice                    | Partial     | Consent dialog exists in advisor-selection.tsx. But ConsentNotice component is dead code. Consent API integration unclear.                                                                                             |
| FR-12 | Graceful errors                           | Partial     | Route-level error.tsx with RouteStateScreen across all route groups. Retry button in chat-messages.tsx. Cancel stream via AbortController. Chat error state still lacks retry after final error display in some paths. |
| FR-13 | Manual cache refresh                      | Implemented | PromptCacheController has refresh endpoint. Admin UI has refresh dialog with confirmation.                                                                                                                             |
| FR-14 | Shared DNA grounding                      | Partial     | DnaDigestsRepository + CompiledSystemPromptBuilder exist. But digest generation depends on DeterministicPromptContextService in demo mode. No real summarization pipeline visible.                                     |
| FR-15 | See and resume past conversations         | Partial     | History page lists conversations. But clicking a conversation navigates to chat with conversationId — the resume flow depends on loading prior messages, which works. However, no pagination (H1) and no search.       |

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
