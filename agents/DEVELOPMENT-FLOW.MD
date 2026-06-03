# Development Flow

> **Guide only — take as a grain of salt. Actual sequencing may deviate.**

---

## Phase 1 — Foundation, Auth & Shell

**Sync at end:** Login works, roles assigned, both land on the right page.

### Person A
- Repo and Vercel project setup, environment config, secrets structure
- Supabase project initialized, users table with allow-list, role, and active toggle
- Google OAuth2 backend wired up, allow-list check enforced at login, role assigned to session
- Non-allow-listed accounts hard-blocked with a clear message

### Person B
- Login page UI
- First-run consent/logging notice — shown and acknowledged before proceeding
- App shell: after login, EIF lands on advisor selection screen (placeholder advisors for now)
- Admin landing stub (placeholder)
- Both screens are role-aware (EIF vs admin routes)

---

## Phase 2 — Data Layer & Advisor Registry

**Sync at end:** Full schema live, RLS verified, advisor registry readable, model config seeded.

### Person A
- All Supabase tables created: conversations, messages, usage_counters, model_config
- RLS configured: EIFs read/write only their own rows; admin bypasses for usage views
- model_config seeded with default provider/model per advisor (cheap/fast model as MVP default)
- Cross-user RLS isolation explicitly tested and verified

### Person B
- Advisor registry defined server-side (advisorId → { name, docId, model })
- Advisor selection screen wired to real registry (real advisor names/data, still no chat)
- Google Docs API service account set up, credentials in env vars only
- Basic Doc fetch working for at least one advisor Doc (raw content, no cache yet)

---

## Phase 3 — Prompt/DNA Pipeline & Cost Guard

**Sync at end:** Server can load prompts, generate DNA digest, and enforce all caps before any LLM is called.

### Person A
- Prompt loader: fetch each advisor's Doc by docId, cache with 5-min TTL
- DNA loader: fetch DNA Doc, summarize into compact digest using configurable default model (separate entry in model_config, defaulting to a cheap/fast model), cache with 5-min TTL
- Cache miss/hit logic; fallback on Doc fetch failure (use last-good cache; error if no cache)
- Doc revision ID and DNA digest version/hash captured for logging
- Confirmed: zero prompt/DNA text leaves the server

### Person B
- usage_counters read/write logic
- Per-user daily message cap, token cap, and spend cap enforced server-side pre-call
- Global daily and monthly budget ceilings enforced pre-call
- Per-user per-minute rate limit
- Calendar-day reset logic in Asia/Manila timezone
- Hard block on any breach: no provider call made, block logged with reason, clear user-facing message per block type (cap, budget, rate — rate includes retry guidance)

---

## Phase 4 — Vertical Slice: One Advisor End-to-End

> **Decide at start of phase:** Pick whichever advisor has the most complete prompt Doc.
>
> **Sync at end:** One full working flow reviewed together — this is the biggest milestone before expanding.
>
> **Full slice:** Login → advisor selection → send message → cost guard → prompt/DNA → LLM → stream → turn persisted

### Person A
- Multi-provider LLM adapters (OpenAI, Gemini, Anthropic) with a consistent internal interface
- model_config drives which provider/model is used at call time
- Server-side assembly: DNA digest + advisor prompt + conversation history + new message → LLM
- Streamed response back to client, full turn persisted on completion: tokens, cost estimate, latency, status, doc revision ID, DNA digest version
- Graceful error handling: provider timeout, partial stream — logged as error, never surfaces internals

### Person B
- Chat UI: message input, streamed response rendering token by token
- Conversation created on first message, wired to Supabase
- Cost guard messages surfaced in UI: cap hit, budget hit, rate limit hit — each with a clear non-technical message
- Provider/Doc/Supabase error states visible in UI
- Consent notice confirmed wired to real session

---

## Phase 5 — All Advisors + Conversation History

**Sync at end:** All 3 advisors work, history visible and resumable, cross-user isolation confirmed.

### Person A
- Expand LLM pipeline to remaining 2 advisors (config-only, same pipeline)
- Conversation resume: load prior messages from Supabase into LLM context on resume
- Auto-title conversation derived from first message
- Verify: loading another user's conversation ID by direct URL returns nothing

### Person B
- Conversation list screen: EIF sees their own threads ordered by most recent
- Selecting a conversation loads full message history into chat UI
- Resume flow: new message continues with full prior context visible in UI
- Advisor selection screen handles all 3 advisors correctly

---

## Phase 6 & 7 — Run in Parallel

> These two can be done simultaneously after Phase 5.

### Phase 6 — Admin Dashboard & Controls

#### Person A
- Admin usage view: per-user and aggregate token counts and estimated spend pulled from Supabase
- `admin_model_changed` and `admin_cache_refresh` events logged correctly

#### Person B
- Admin UI: usage table, model config per advisor (including DNA summarization model), manual cache refresh trigger
- All admin routes role-gated — EIFs blocked from accessing them

### Phase 7 — Hardening, Security & Acceptance Testing

> **Both people work this together** — no A/B split here. Go through it systematically:

- Adversarial test: inspect all network traffic for all 3 advisors and confirm zero prompt/DNA text in responses, headers, or errors
- RLS isolation test: confirm one EIF's session cannot retrieve another's data under any condition
- All edge cases verified: non-allow-listed login, cap hit mid-session, rate limit hit, Doc fetch failure with and without cache, provider error/timeout, Supabase write failure, EIF asking the advisor for the system prompt or DNA
- All telemetry events confirmed logging in Supabase
- Prompt/DNA edit in Google Docs → wait TTL → confirm new behavior live, no redeploy — demonstrated live
- End-to-end run for all 3 advisors: streaming, persistence, cost logging all correct
- Weighted rubric scored across representative sessions — target ≥ 3.5/5
- Open questions resolved or formally deferred: 3rd advisor purpose, retention policy, exact cap values

---

## Blueprint for Updating This File

When the implementation plan changes:

1. **Phase boundaries** — adjust if a sync point moves or phases merge/split
2. **Person A/B assignments** — rebalance as team context shifts
3. **Phase content** — add/remove tasks as scope clarifies
4. **Preconditions** — update sync-at-end criteria when dependencies shift

This file is a **guide, not a contract**. If actual implementation diverges, update this file to match reality rather than forcing reality to match the file. Mark deviations clearly.

Keep in sync with:
- `AGENTS.md` (Commands section — new scripts/tools needed by a phase)
- `PRD.md` (if phase scope no longer aligns with FRs)
- `CHANGE_PROCESS.md` (if new patterns or edge cases emerge)
