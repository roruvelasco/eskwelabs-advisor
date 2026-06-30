# Database

## Stack

- **Driver**: `postgres` (npm package, not `pg` or `@neondatabase/serverless`)
- **ORM**: Drizzle ORM with `casing: 'snake_case'`
- **Migrations**: Drizzle Kit (`bun run db:generate` → `bun run db:migrate`)
- **Config**: `drizzle.config.ts` at monorepo root, schema source `packages/server/src/db/drizzle-schema.ts`
- **Local**: Supabase via `bun run db:start` / `bun run db:stop`

## Schema Registry

All table schemas are re-exported from `packages/server/src/db/drizzle-schema.ts`:

```ts
export * from '../users/users.schema';
export * from '../advisors/advisors.schema';
export * from '../advisors/advisor-runtime.schema';
export * from '../conversations/conversations.schema';
export * from '../messages/messages.schema';
export * from '../model-config/model-config.schema';
export * from '../prompt-cache/prompt-cache.schema';
export * from '../prompt-cache/prompt-snapshots.schema';
export * from '../prompt-cache/dna-digests.schema';
export * from '../prompt-cache/dna-source-config.schema';
export * from '../usage-counters/usage-counters.schema';
export * from '../telemetry/telemetry.schema';
export * from '../conversation-titles/conversation-title-jobs.schema';
```

DrizzleService (singleton) applies casing and schema:

```ts
this.db = drizzle(this.client, { schema, casing: 'snake_case' });
```

## Table Schemas

### `users` (`usersTable` in code, `users` in DB)

| Column                    | Type                | Constraints                                  |
| ------------------------- | ------------------- | -------------------------------------------- |
| `id`                      | `uuid`              | PK, auto-generated via `crypto.randomUUID()` |
| `email`                   | `text`              | NOT NULL, UNIQUE                             |
| `role`                    | `text`              | NOT NULL, default `'eif'`                    |
| `is_active`               | `boolean`           | NOT NULL, default `true`                     |
| `consent_acknowledged_at` | `timestamp with tz` | nullable                                     |
| `created_at`              | `timestamp with tz` | NOT NULL, default `now()`                    |

Type: `User`

Indexes: `users_created_desc_idx` on `(created_at DESC, id DESC)`.

### `advisors` (`advisorsTable` in code, `advisors` in DB)

| Column        | Type                | Constraints               |
| ------------- | ------------------- | ------------------------- |
| `id`          | `text`              | PK                        |
| `name`        | `text`              | NOT NULL                  |
| `description` | `text`              | NOT NULL, default `''`    |
| `is_active`   | `boolean`           | NOT NULL, default `true`  |
| `created_at`  | `timestamp with tz` | NOT NULL, default `now()` |

Type: `Advisor`

### `conversations` (`conversationsTable` in code, `conversations` in DB)

| Column       | Type                | Constraints                                 |
| ------------ | ------------------- | ------------------------------------------- |
| `id`         | `uuid`              | PK, auto-generated                          |
| `user_id`    | `uuid`              | NOT NULL                                    |
| `advisor_id` | `text`              | NOT NULL                                    |
| `title`      | `text`              | NOT NULL, default `'Untitled conversation'` |
| `status`     | `text`              | NOT NULL, default `'active'`                |
| `created_at` | `timestamp with tz` | NOT NULL, default `now()`                   |
| `updated_at` | `timestamp with tz` | NOT NULL, default `now()`                   |

Indexes: `conversations_user_updated_idx` on `(user_id, updated_at DESC, id DESC)`, `conversations_user_advisor_updated_idx` on `(user_id, advisor_id, updated_at DESC, id DESC)`.

Type: `Conversation`

### `messages` (`messagesTable` in code, `messages` in DB)

| Column                      | Type                | Constraints               |
| --------------------------- | ------------------- | ------------------------- |
| `id`                        | `uuid`              | PK, auto-generated        |
| `conversation_id`           | `uuid`              | NOT NULL                  |
| `user_id`                   | `uuid`              | NOT NULL                  |
| `role`                      | `text`              | NOT NULL                  |
| `content`                   | `text`              | NOT NULL                  |
| `provider`                  | `text`              | nullable                  |
| `model`                     | `text`              | nullable                  |
| `prompt_tokens`             | `integer`           | nullable                  |
| `completion_tokens`         | `integer`           | nullable                  |
| `estimated_cost_usd`        | `numeric`           | nullable                  |
| `latency_ms`                | `integer`           | nullable                  |
| `status`                    | `text`              | NOT NULL, default `'ok'`  |
| `block_reason`              | `text`              | nullable                  |
| `prompt_doc_revision`       | `text`              | nullable                  |
| `dna_digest_version`        | `text`              | nullable                  |
| `prompt_snapshot_hash`      | `text`              | nullable                  |
| `system_prompt_hash`        | `text`              | nullable                  |
| `knowledge_context_hash`    | `text`              | nullable                  |
| `knowledge_resolution_mode` | `text`              | nullable                  |
| `knowledge_unit_count`      | `integer`           | nullable                  |
| `seq`                       | `bigint`            | NOT NULL, sequence-backed |
| `created_at`                | `timestamp with tz` | NOT NULL, default `now()` |

Type: `Message`

Indexes: partial unique index on `(user_id, client_turn_id)` where `client_turn_id IS NOT NULL`, `messages_convo_created_asc_idx` on `(conversation_id, created_at ASC, id ASC)`, `messages_convo_created_desc_idx` on `(conversation_id, created_at DESC, id DESC)`, `messages_convo_seq_asc_idx` on `(conversation_id, seq ASC)`, `messages_convo_seq_desc_idx` on `(conversation_id, seq DESC)`.

### `model_config` (`modelConfigTable` in code, `model_config` in DB)

| Column       | Type                | Constraints               |
| ------------ | ------------------- | ------------------------- |
| `advisor_id` | `text`              | PK                        |
| `provider`   | `text`              | NOT NULL                  |
| `model`      | `text`              | NOT NULL                  |
| `is_enabled` | `boolean`           | NOT NULL, default `true`  |
| `updated_by` | `text`              | nullable                  |
| `updated_at` | `timestamp with tz` | NOT NULL, default `now()` |

Type: `ModelConfig`

### `prompt_cache` (`promptCacheTable` in code, `prompt_cache` in DB)

| Column               | Type                | Constraints               |
| -------------------- | ------------------- | ------------------------- |
| `key`                | `text`              | PK                        |
| `value_hash`         | `text`              | NOT NULL                  |
| `doc_revision`       | `text`              | nullable                  |
| `dna_digest_version` | `text`              | nullable                  |
| `last_good_at`       | `timestamp with tz` | nullable                  |
| `expires_at`         | `timestamp with tz` | NOT NULL                  |
| `updated_at`         | `timestamp with tz` | NOT NULL, default `now()` |

Type: `PromptCacheEntry`

Indexes: `prompt_cache_updated_key_idx` on `(updated_at DESC, key)`.

### `prompt_snapshots` (`promptSnapshotsTable` in code, `prompt_snapshots` in DB)

| Column              | Type                | Constraints                     |
| ------------------- | ------------------- | ------------------------------- |
| `id`                | `uuid`              | PK, default `gen_random_uuid()` |
| `advisor_id`        | `text`              | NOT NULL                        |
| `doc_id`            | `text`              | NOT NULL                        |
| `revision`          | `text`              | NOT NULL                        |
| `content_text`      | `text`              | NOT NULL, server-only           |
| `hash`              | `text`              | NOT NULL                        |
| `is_active`         | `boolean`           | NOT NULL, default `true`        |
| `validation_status` | `text`              | nullable                        |
| `validation_reason` | `text`              | nullable                        |
| `created_at`        | `timestamp with tz` | NOT NULL, default `now()`       |

Indexes: partial unique index on `advisor_id` where `is_active = true`.

Type: `PromptSnapshotRow`

### `dna_digests` (`dnaDigestsTable` in code, `dna_digests` in DB)

| Column              | Type                | Constraints                     |
| ------------------- | ------------------- | ------------------------------- |
| `id`                | `uuid`              | PK, default `gen_random_uuid()` |
| `doc_id`            | `text`              | NOT NULL                        |
| `revision`          | `text`              | NOT NULL                        |
| `source_hash`       | `text`              | NOT NULL, default `''`          |
| `digest_text`       | `text`              | NOT NULL, server-only           |
| `hash`              | `text`              | NOT NULL                        |
| `is_active`         | `boolean`           | NOT NULL, default `true`        |
| `validation_status` | `text`              | nullable                        |
| `validation_reason` | `text`              | nullable                        |
| `created_at`        | `timestamp with tz` | NOT NULL, default `now()`       |

Indexes: partial unique index where `is_active = true`.

Type: `DnaDigestRow`

### `dna_source_config` (`dnaSourceConfigTable` in code, `dna_source_config` in DB)

Stores the admin-managed shared DNA Google Doc ID. Runtime DNA ingestion reads this row first and falls back to `GOOGLE_DOCS_DNA_DOC_ID` only when no DB config exists.

| Column       | Type                | Constraints               |
| ------------ | ------------------- | ------------------------- |
| `id`         | `text`              | PK, default `'default'`   |
| `doc_id`     | `text`              | NOT NULL                  |
| `updated_by` | `text`              | nullable                  |
| `created_at` | `timestamp with tz` | NOT NULL, default `now()` |
| `updated_at` | `timestamp with tz` | NOT NULL, default `now()` |

Type: `DnaSourceConfigRow`

### `knowledge_sources` (`knowledgeSourcesTable` in code, `knowledge_sources` in DB)

Tracks source documents and revision metadata for the source-backed knowledge layer.

Key columns: `id`, `source_type`, `external_id`, `title`, `url`, `owner`, `status`, `audience`, `advisor_scope`, `content_type`, `revision`, `source_hash`, `metadata`, `last_ingested_at`, timestamps.

Indexes: `knowledge_sources_external_idx` on `(source_type, external_id)`, `knowledge_sources_status_idx` on `(status, updated_at DESC)`.

### `knowledge_units` (`knowledgeUnitsTable` in code, `knowledge_units` in DB)

Versioned source-backed chunks/sections selected at chat time.

Key columns: `id`, `source_id`, `source_revision`, `section_path`, `content_type`, `advisor_scope`, `audience`, `status`, `text` (server-only), `summary`, `content_hash`, `effective_from`, `effective_to`, `metadata`, timestamps.

Indexes: `knowledge_units_source_revision_idx`, `knowledge_units_scope_status_idx`, `knowledge_units_hash_idx`, `knowledge_units_fts_idx` (partial GIN on `to_tsvector('english', coalesce(text, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(section_path, ''))` where `status = 'published'`).

### `knowledge_embeddings` (`knowledgeEmbeddingsTable` in code, `knowledge_embeddings` in DB)

pgvector-powered embedding storage for semantic retrieval. Acts as a query-optimized retrieval projection with denormalized filter metadata (copied from `knowledge_units` on upsert) so the HNSW index can filter same-table candidates before joining unit content.

Key columns: `id`, `unit_id`, `provider`, `model`, `dimensions`, `embedding` (vector(768)), `external_vector_id`, `embedding_hash`, `indexed_at`, `status`, `advisor_scope`, `content_type`, `audience`, `source_revision`, `content_hash`, `effective_from`, `effective_to`.

Indexes: `knowledge_embeddings_unit_provider_uniq` (unique B-tree on `unit_id, provider, model`), `knowledge_embeddings_filter_idx` (B-tree on `provider, model, status, advisor_scope, content_type`), `knowledge_embeddings_published_hnsw_idx` (partial HNSW on `embedding vector_cosine_ops` with `m = 16, ef_construction = 64` where `embedding IS NOT NULL AND status = 'published'`).

### `knowledge_rules` (`knowledgeRulesTable` in code, `knowledge_rules` in DB)

Structured high-confidence operational facts used before vector retrieval.

Key columns: `id`, `topic`, `applies_to`, `canonical_answer`, `source_unit_id`, `priority`, `status`, `effective_from`, `effective_to`, timestamps.

Indexes: `knowledge_rules_fts_idx` (partial GIN on `to_tsvector('english', coalesce(topic, '') || ' ' || coalesce(canonical_answer, ''))` where `status = 'published'`).

### `message_knowledge_audit` (`messageKnowledgeAuditTable` in code, `message_knowledge_audit` in DB)

Per-assistant-message audit of selected source-backed context.

Key columns: `id`, `message_id`, `unit_id`, `rule_id`, `source_revision`, `content_hash`, `selection_rank`, `score`, `resolver_strategy`, `used_in_prompt`, `created_at`.

### `usage_counters` (`usageCountersTable` in code, `usage_counters` in DB)

| Column                      | Type      | Constraints             |
| --------------------------- | --------- | ----------------------- |
| `user_id`                   | `uuid`    | NOT NULL                |
| `day_ph`                    | `date`    | NOT NULL                |
| `messages_today`            | `integer` | NOT NULL, default `0`   |
| `tokens_today`              | `integer` | NOT NULL, default `0`   |
| `estimated_spend_today_usd` | `numeric` | NOT NULL, default `'0'` |

PK: composite `(user_id, day_ph)`
Indexes: `usage_counters_day_ph_user_idx` on `(day_ph DESC, user_id)`.
Type: `UsageCounter`

### `usage_limit_audit_events` (`usageLimitAuditEventsTable` in code, `usage_limit_audit_events` in DB)

| Column            | Type                | Constraints                         |
| ----------------- | ------------------- | ----------------------------------- |
| `id`              | `uuid`              | PK, default `gen_random_uuid()`     |
| `changed_by`      | `text`              | Admin actor id                      |
| `previous_config` | `jsonb`             | Previous global limits config       |
| `next_config`     | `jsonb`             | NOT NULL, next global limits config |
| `created_at`      | `timestamp with tz` | NOT NULL, default `now()`           |

Type: `UsageLimitAuditEvent`

### `telemetry_events` (`telemetryEventsTable` in code, `telemetry_events` in DB)

| Column       | Type                | Constraints                |
| ------------ | ------------------- | -------------------------- |
| `id`         | `uuid`              | PK, auto-generated         |
| `event_name` | `text`              | NOT NULL                   |
| `actor_id`   | `uuid`              | nullable                   |
| `severity`   | `text`              | NOT NULL, default `'info'` |
| `payload`    | `jsonb`             | NOT NULL, default `{}`     |
| `created_at` | `timestamp with tz` | NOT NULL, default `now()`  |

Type: `TelemetryEvent`

Indexes: `telemetry_events_created_desc_idx` on `(created_at DESC, id DESC)`, `telemetry_events_event_created_idx` on `(event_name, created_at DESC, id DESC)`.

### `admin` (`adminSchemaPlaceholder` in code, no DB table)

The admin domain has no DB table — it's a service-only domain that queries across other domains for the admin dashboard overview.

### `advisor_runtime_versions` (`advisorRuntimeVersionsTable` in code, `advisor_runtime_versions` in DB)

| Column                    | Type                | Constraints                     |
| ------------------------- | ------------------- | ------------------------------- |
| `id`                      | `uuid`              | PK, default `gen_random_uuid()` |
| `advisor_id`              | `text`              | NOT NULL, FK → advisors         |
| `prompt_snapshot_id`      | `uuid`              | NOT NULL, FK → prompt_snapshots |
| `dna_digest_id`           | `uuid`              | NOT NULL, FK → dna_digests      |
| `model_config_advisor_id` | `text`              | NOT NULL, FK → model_config     |
| `version_number`          | `integer`           | NOT NULL                        |
| `status`                  | `text`              | NOT NULL, default `'published'` |
| `published_at`            | `timestamp with tz` | NOT NULL, default `now()`       |
| `published_by`            | `text`              | nullable                        |
| `created_at`              | `timestamp with tz` | NOT NULL, default `now()`       |

Type: `AdvisorRuntimeVersion`

Indexes: `advisor_runtime_versions_advisor_status_version_idx` on `(advisor_id, status, version_number DESC)`.

### `conversation_title_jobs` (`conversationTitleJobsTable` in code, `conversation_title_jobs` in DB)

| Column                 | Type                | Constraints                            |
| ---------------------- | ------------------- | -------------------------------------- |
| `id`                   | `uuid`              | PK, default `gen_random_uuid()`        |
| `conversation_id`      | `uuid`              | NOT NULL, FK → conversations (CASCADE) |
| `user_message_id`      | `uuid`              | NOT NULL                               |
| `assistant_message_id` | `uuid`              | NOT NULL                               |
| `status`               | `text`              | NOT NULL, default `'pending'`          |
| `claimed_by`           | `text`              | nullable                               |
| `claimed_at`           | `timestamp with tz` | nullable                               |
| `lease_expires_at`     | `timestamp with tz` | nullable                               |
| `attempt_count`        | `integer`           | NOT NULL, default `0`                  |
| `last_error`           | `text`              | nullable                               |
| `title`                | `text`              | nullable                               |
| `created_at`           | `timestamp with tz` | NOT NULL, default `now()`              |
| `updated_at`           | `timestamp with tz` | NOT NULL, default `now()`              |

Indexes: composite on `(status, claimed_at)` for claim queries, composite on `(status, lease_expires_at)` for stale job recovery, unique on `conversation_id`.

Type: `ConversationTitleJob`

## Relationship Map

```
users ──1:N── conversations ──1:N── messages
  │                                    │
  └──────── usage_counters ────────────┘
        (per user per day)

advisors ──1:1── model_config
advisors ──1:N── conversations
advisors ──1:N── advisor_runtime_versions
                     │
         ┌───────────┼───────────┐
         │           │           │
   prompt_snapshots  dna_digests  model_config

advisor_runtime_versions ──1:N── conversations (via advisor_runtime_version_id)

conversations ──1:1── conversation_title_jobs

knowledge_sources ──1:N── knowledge_units ──1:N── knowledge_embeddings
knowledge_units ──1:N── knowledge_rules
messages ──1:N── message_knowledge_audit ──N:1── knowledge_units / knowledge_rules
```

## Row-Level Security (RLS)

RLS is enabled on all tables as defense-in-depth against direct Supabase API access. This does not affect the current Hono/Drizzle write path, which uses the service-role key and bypasses RLS.

Migration `0014_complete_rls_coverage` defines the base policy posture. Migration `0017_knowledge_architecture` enables RLS for the knowledge tables as service-only tables.

### User-owned tables (EIF self-read via auth.uid(), admin full access)

| Table           | EIF policy                                                                                 | Admin policy               |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| `users`         | `eif_read_own_users` (SELECT, `auth.uid()::uuid = id`)                                     | `admin_full_users`         |
| `conversations` | `eif_read_own_conversations` (SELECT, `auth.uid()::uuid = user_id AND deleted_at IS NULL`) | `admin_full_conversations` |
| `messages`      | `eif_read_own_messages` (SELECT via conversation ownership subquery)                       | `admin_full_messages`      |

### Public / admin tables

| Table                      | Public policy                                              | Admin policy                                                                    |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `advisors`                 | `public_read_active_advisors` (SELECT, `is_active = true`) | `admin_full_advisors`                                                           |
| `model_config`             | —                                                          | `admin_select_model_config` + `admin_full_model_config`                         |
| `usage_counters`           | —                                                          | `admin_select_usage_counters` + `admin_full_usage_counters`                     |
| `usage_limits`             | —                                                          | `admin_select_usage_limits` + `admin_full_usage_limits`                         |
| `usage_limit_audit_events` | —                                                          | `admin_select_usage_limit_audit_events` + `admin_full_usage_limit_audit_events` |
| `telemetry_events`         | —                                                          | `admin_select_telemetry_events` + `admin_full_telemetry_events`                 |

### Service-only tables (no direct Supabase client policies)

These tables are intentionally left with no SELECT/INSERT/UPDATE/DELETE policies. Access is exclusively through Hono endpoints with server-side authorization:

`prompt_snapshots`, `dna_digests`, `prompt_cache`, `advisor_runtime_versions`, `conversation_title_jobs`, `usage_budget_counters`, `knowledge_sources`, `knowledge_units`, `knowledge_embeddings`, `knowledge_rules`, `message_knowledge_audit`.

**Note:** These RLS policies rely on `auth.uid()` and `request.jwt.claim.role` (Supabase Auth context). The current NextAuth + Drizzle app path does not carry Supabase JWTs into Postgres, so the policies are defense only against direct Supabase API access. Full RLS enforcement for app requests would require a non-owner DB role and per-request DB actor context — a separate follow-up.

- Users are retained for audit history and access is revoked with `users.is_active = false`; there is no physical user delete flow in the API.
- User-owned records therefore keep `NO ACTION`/restrictive user FKs so accidental hard deletion cannot orphan conversations, messages, usage counters, or telemetry.
- Conversations can be physically deleted by their owner. Conversation-owned children (`messages`, `conversation_title_jobs`) cascade so the conversation delete is atomic and leaves no thread-local rows behind.
- Advisor/runtime/prompt/DNA records are retained for auditability; runtime-version FKs block deletion while referenced by active advisors or historical conversations.

`prompt_cache`, `usage_limit_audit_events`, and `telemetry_events` are standalone tables (not directly FK-referenced). Prompt/DNA text fields and raw knowledge unit text are server-only and must not be serialized to clients.

## Current Status

- All schemas are defined in Drizzle (19 tables)
- Migrations can be generated (`bun run db:generate`) and applied (`bun run db:migrate`)
- Most repositories use Drizzle queries against real Postgres tables
- The `admin` domain has a stub schema (no actual DB table)

## Adding a New Table

1. Create `<domain>/<domain>.schema.ts` with your `pgTable` definition
2. Export from `packages/server/src/db/drizzle-schema.ts`
3. Run `bun run db:generate` → `bun run db:migrate`
4. Create repository extending `Repository` with Drizzle queries via `this.drizzle.db`

Never write manual SQL migrations — always use `bun run db:generate` then `bun run db:migrate`.
