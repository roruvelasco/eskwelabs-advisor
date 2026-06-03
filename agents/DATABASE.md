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
export * from '../conversations/conversations.schema';
export * from '../messages/messages.schema';
export * from '../model-config/model-config.schema';
export * from '../prompt-cache/prompt-cache.schema';
export * from '../usage-counters/usage-counters.schema';
export * from '../telemetry/telemetry.schema';
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

Type: `Conversation`

### `messages` (`messagesTable` in code, `messages` in DB)

| Column                | Type                | Constraints               |
| --------------------- | ------------------- | ------------------------- |
| `id`                  | `uuid`              | PK, auto-generated        |
| `conversation_id`     | `uuid`              | NOT NULL                  |
| `user_id`             | `uuid`              | NOT NULL                  |
| `role`                | `text`              | NOT NULL                  |
| `content`             | `text`              | NOT NULL                  |
| `provider`            | `text`              | nullable                  |
| `model`               | `text`              | nullable                  |
| `prompt_tokens`       | `integer`           | nullable                  |
| `completion_tokens`   | `integer`           | nullable                  |
| `estimated_cost_usd`  | `numeric`           | nullable                  |
| `latency_ms`          | `integer`           | nullable                  |
| `status`              | `text`              | NOT NULL, default `'ok'`  |
| `block_reason`        | `text`              | nullable                  |
| `prompt_doc_revision` | `text`              | nullable                  |
| `dna_digest_version`  | `text`              | nullable                  |
| `created_at`          | `timestamp with tz` | NOT NULL, default `now()` |

Type: `Message`

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

### `usage_counters` (`usageCountersTable` in code, `usage_counters` in DB)

| Column                      | Type      | Constraints             |
| --------------------------- | --------- | ----------------------- |
| `user_id`                   | `uuid`    | NOT NULL                |
| `day_ph`                    | `date`    | NOT NULL                |
| `messages_today`            | `integer` | NOT NULL, default `0`   |
| `tokens_today`              | `integer` | NOT NULL, default `0`   |
| `estimated_spend_today_usd` | `numeric` | NOT NULL, default `'0'` |

PK: composite `(user_id, day_ph)`
Type: `UsageCounter`

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

### `admin` (`adminSchemaPlaceholder` in code, no DB table)

The admin domain has no DB table — it's a service-only domain that queries across other domains for the admin dashboard overview.

## Relationship Map

```
users ──1:N── conversations ──1:N── messages
  │                                    │
  └──────── usage_counters ────────────┘
        (per user per day)

advisors ──1:1── model_config
advisors ──1:N── conversations
```

`prompt_cache` and `telemetry_events` are standalone tables (not directly FK-referenced).

## Current Status

- All schemas are defined in Drizzle
- Migrations can be generated (`bun run db:generate`) and applied (`bun run db:migrate`)
- Repositories currently use **in-memory Maps** — Drizzle queries are NOT yet implemented
- The `admin` domain has a stub schema (no actual DB table)

## Adding a New Table

1. Create `<domain>/<domain>.schema.ts` with your `pgTable` definition
2. Export from `packages/server/src/db/drizzle-schema.ts`
3. Run `bun run db:generate` → `bun run db:migrate`
4. Create repository extending `Repository` with Drizzle queries via `this.drizzle.db`

Never write manual SQL migrations — always use `bun run db:generate` then `bun run db:migrate`.
