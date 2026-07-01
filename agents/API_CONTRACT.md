# API Contract

All routes are registered at `packages/server/src/application.controller.ts` under `basePath('/api')`.

Common response envelope for errors:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Error codes: `forbidden` (403), `unauthorized` (401), `not_found` (404), `rate_limited` (429), `validation_failed` (400), `server_error` (500).

## Pagination

All list endpoints support cursor-based pagination via query params:

| Param    | Type   | Default | Description                                       |
| -------- | ------ | ------- | ------------------------------------------------- |
| `limit`  | number | 50      | Page size (min 1, max 100)                        |
| `cursor` | string | —       | Opaque base64url-encoded cursor token from `meta` |

Paginated responses include metadata:

```json
{
  "data": [...],
  "meta": { "nextCursor": "string | null", "limit": 50 }
}
```

When `nextCursor` is `null`, there are no more pages. Pass the cursor to the next request to fetch the next page. Cursor tokens are opaque and endpoint-specific; do not construct them manually.

---

## Health & Info

| Method | Path           | Auth | Description                     |
| ------ | -------------- | ---- | ------------------------------- |
| `GET`  | `/api/`        | None | Service info `{ status, name }` |
| `GET`  | `/api/healthz` | None | Health check `{ status: 'ok' }` |

## Session (Frontend)

`/api/session` is a Next.js route handler (not Hono). It verifies the NextAuth JWT server-side and returns the current session actor.

| Method | Path           | Auth     | Description                                                |
| ------ | -------------- | -------- | ---------------------------------------------------------- |
| `GET`  | `/api/session` | NextAuth | Get current session actor `{ data: SessionActor \| null }` |

Response: `{ data: { id, email, role, isActive } | null }`

---

## Advisors

**Controller**: `AdvisorController` (`packages/server/src/advisors/`)
**Auth**: `requireActor(['eif', 'admin'])` on public list, `requireActor(['admin'])` on admin prompt-source routes

| Method   | Path                                           | Body                                                                         | Description                                    |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `GET`    | `/api/advisors`                                | —                                                                            | List all active public advisors                |
| `GET`    | `/api/admin/advisors`                          | `?search&status&isActive&limit&cursor`                                       | List advisors for admin management             |
| `POST`   | `/api/admin/advisors`                          | `{ id, name, description?, promptDocId?, status?, isActive?, modelConfig? }` | Create an advisor                              |
| `PATCH`  | `/api/admin/advisors/:advisorId`               | `{ name?, description?, promptDocId?, status?, isActive?, modelConfig? }`    | Update advisor metadata/lifecycle              |
| `DELETE` | `/api/admin/advisors/:advisorId`               | —                                                                            | Soft-disable an advisor                        |
| `POST`   | `/api/admin/advisors/:advisorId/publish`       | —                                                                            | Publish a runnable advisor runtime version     |
| `GET`    | `/api/admin/advisors/prompt-sources`           | —                                                                            | List admin-only advisor prompt Doc ID metadata |
| `PATCH`  | `/api/admin/advisors/:advisorId/prompt-source` | `{ promptDocId: string \| null }`                                            | Update an advisor prompt Google Doc ID         |

Response: `{ data: Advisor[] }`

---

## Users

**Controller**: `UsersController` (`packages/server/src/users/`)
**Auth**: `requireActor(['eif', 'admin'])` on `/api/consent`, `requireActor(['admin'])` on admin routes

| Method  | Path                   | Body                                              | Description                                                         |
| ------- | ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `POST`  | `/api/consent`         | —                                                 | Acknowledge consent for current actor                               |
| `GET`   | `/api/admin/users`     | —                                                 | List all users (admin only, paginated: `?role&search&limit&cursor`) |
| `POST`  | `/api/admin/users`     | `{ email: string, role: "eif" \| "admin" }`       | Create or reactivate user (admin only)                              |
| `PATCH` | `/api/admin/users/:id` | `{ role?: "eif" \| "admin", isActive?: boolean }` | Update user role/status (admin only, self-deactivation guarded)     |

Request body (`POST /api/admin/users`):

```json
{ "email": "user@example.com", "role": "eif" }
```

Request body (`PATCH /api/admin/users/:id`):

```json
{ "role": "admin", "isActive": true }
```

Response: `{ data: User }`

**Self-deactivation guard**: Admin cannot set `isActive: false` or change `role` on their own user record. Returns `403 Forbidden` with code `forbidden`.

---

## Conversations

**Controller**: `ConversationController` (`packages/server/src/conversations/`)
**Auth**: `requireActor(['eif', 'admin'])`

| Method   | Path                     | Query / Body                            | Description                                      |
| -------- | ------------------------ | --------------------------------------- | ------------------------------------------------ |
| `GET`    | `/api/conversations`     | `?advisorId&search&limit&cursor`        | List conversations for current actor (paginated) |
| `POST`   | `/api/conversations`     | `{ advisorId: string, title?: string }` | Create conversation                              |
| `GET`    | `/api/conversations/:id` | —                                       | Get conversation detail                          |
| `DELETE` | `/api/conversations/:id` | —                                       | Delete conversation (owner-only)                 |

Response (list, paginated): `{ data: Conversation[], meta: { nextCursor: string | null, limit: number } }`
Response (single): `{ data: Conversation }`
Response (delete): `204 No Content`

**Auth (delete)**: `requireActor(['eif', 'admin'])` + `requireConsent()` | **Scope**: owner-only | **Errors**: `400` (invalid UUID), `404` (not found / not owner) | **Side effect**: messages for the conversation are deleted through DB cascade

---

## Messages / Chat Turn

**Controller**: `MessageController` (`packages/server/src/messages/`)
**Auth**: `requireActor(['eif', 'admin'])`

| Method | Path                    | Body                                              | Description                                 |
| ------ | ----------------------- | ------------------------------------------------- | ------------------------------------------- |
| `GET`  | `/api/messages`         | `?conversationId=uuid&limit=number&cursor=string` | List messages in a conversation (paginated) |
| `POST` | `/api/chat-turn`        | `{ conversationId: uuid, content: string }`       | Send a turn, get response                   |
| `POST` | `/api/chat-turn/stream` | `{ conversationId: uuid, content: string }`       | SSE-streamed chat turn                      |

Response (list, paginated): `{ data: Message[], meta: { nextCursor: string | null, limit: number } }`

### Stream Events (`POST /api/chat-turn/stream`)

- `event: chunk` / `data: <string>` — partial content delta
- `event: final` / `data: { ... }` — complete response with usage
- `event: error` / `data: { error: { code, message } }` — error occurred

---

## Model Config (Admin)

**Controller**: `ModelConfigController` (`packages/server/src/model-config/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                                 | Body                                                       | Description                     |
| ------ | ------------------------------------ | ---------------------------------------------------------- | ------------------------------- |
| `GET`  | `/api/admin/model-config`            | —                                                          | List all model configs          |
| `PUT`  | `/api/admin/model-config/:advisorId` | `{ provider: string, model: string, isEnabled?: boolean }` | Update model config for advisor |
| `GET`  | `/api/admin/model-config/catalog`    | —                                                          | Available providers and models  |

### Model Catalog

`GET /api/admin/model-config/catalog` returns available providers and their model rates, filtered by `LLM_PROVIDER_MODE` and configured API keys. Provider and model availability match the same logic used by the runtime LLM provider factory.

Response:

```json
{
  "data": {
    "providers": [
      {
        "provider": "groq",
        "label": "Groq",
        "models": [
          {
            "model": "llama-3.3-70b-versatile",
            "inputUsdPerMillionTokens": 0.59,
            "outputUsdPerMillionTokens": 0.79
          }
        ]
      }
    ]
  }
}
```

### Model Config Update Validation

`PUT /api/admin/model-config/:advisorId` validates that the `provider` is in the available set and that the `model` exists in the registered rate table. Either check failing returns:

```json
{
  "error": {
    "code": "model_not_available",
    "message": "Model \"unknown-model\" is not available for provider \"groq\""
  }
}
```

HTTP status: `422 Unprocessable Entity`.

---

## Prompt Cache (Admin)

**Controller**: `PromptCacheController` (`packages/server/src/prompt-cache/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                                                                         | Description                                               |
| ------ | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| `GET`  | `/api/admin/prompt-cache`                                                    | List prompt cache metadata (paginated: `?limit&cursor`)   |
| `GET`  | `/api/admin/prompt-cache/health`                                             | Active prompt/DNA versions, validation status per advisor |
| `POST` | `/api/admin/prompt-cache/refresh`                                            | Ingest prompt/DNA snapshots and warm Redis cache          |
| `GET`  | `/api/admin/prompt-cache/dna-source`                                         | Current shared DNA Doc ID metadata                        |
| `PUT`  | `/api/admin/prompt-cache/dna-source`                                         | Update shared DNA Doc ID `{ docId: string }`              |
| `GET`  | `/api/admin/prompt-cache/advisors/:advisorId/snapshots`                      | List advisor prompt snapshot metadata                     |
| `POST` | `/api/admin/prompt-cache/advisors/:advisorId/snapshots/:snapshotId/activate` | Roll back an advisor to a prior prompt snapshot           |
| `GET`  | `/api/admin/prompt-cache/dna-digests`                                        | List DNA digest metadata                                  |
| `POST` | `/api/admin/prompt-cache/dna-digests/:digestId/activate`                     | Roll back to a prior DNA digest                           |

Prompt cache admin endpoints return metadata only. They never return advisor prompt text or DNA digest text. Refresh returns `{ data: { status, warmed } }`, where `warmed` may include per-advisor/DNA status, revision/hash metadata, and safe failure `code`/`reason` values. Refresh does not invalidate Redis first; it writes and warms new context and lets old keys expire naturally.

---

## Knowledge (Admin)

**Controller**: `KnowledgeController` (`packages/server/src/knowledge/`)
**Auth**: `requireActor(['admin'])`

| Method  | Path                                             | Description                                                           |
| ------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `GET`   | `/api/admin/knowledge/sources`                   | List source metadata (paginated: `?limit&cursor&status&advisorScope`) |
| `POST`  | `/api/admin/knowledge/sources`                   | Register a source `{ sourceType, externalId, title, ... }`            |
| `PATCH` | `/api/admin/knowledge/sources/:sourceId`         | Update source metadata / Google Doc ID                                |
| `POST`  | `/api/admin/knowledge/sources/:sourceId/refresh` | Ingest one source into versioned knowledge units                      |
| `POST`  | `/api/admin/knowledge/refresh`                   | Refresh all currently published sources                               |
| `GET`   | `/api/admin/knowledge/sources/:sourceId/units`   | List source-backed unit metadata                                      |
| `GET`   | `/api/admin/knowledge/health`                    | Return knowledge source health summary                                |
| `GET`   | `/api/admin/knowledge/search`                    | Metadata-only admin search preview (`?query&advisorId&limit`)         |

Knowledge admin endpoints do not return raw unit text by default. Chat-time evidence selection is server-only and audited in `message_knowledge_audit`.

---

## Usage Counters (Admin)

**Controller**: `UsageCounterController` (`packages/server/src/usage-counters/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                                | Description                                                                                       |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/admin/usage-counters`         | List usage counters (paginated: `?userId&dayPh&fromDayPh&toDayPh&limit&cursor`)                   |
| `GET`  | `/api/admin/usage-counters/summary` | Aggregate usage trend and top users (`?userId&fromDayPh&toDayPh&topUsersLimit`, max 90-day range) |

Summary response:

```json
{
  "data": {
    "range": {
      "fromDayPh": "2026-06-01",
      "toDayPh": "2026-06-30",
      "timeZone": "Asia/Manila"
    },
    "totals": {
      "messages": 12,
      "tokens": 3456,
      "estimatedSpendUsd": "0.123456",
      "activeUsers": 3
    },
    "days": [
      {
        "dayPh": "2026-06-30",
        "messages": 2,
        "tokens": 512,
        "estimatedSpendUsd": "0.012345"
      }
    ],
    "topUsers": [
      {
        "userId": "uuid",
        "userEmail": "intern@example.com",
        "messages": 5,
        "tokens": 1200,
        "estimatedSpendUsd": "0.050000"
      }
    ]
  }
}
```

---

## Usage Limits (Admin)

**Controller**: `UsageLimitsController` (`packages/server/src/usage-limits/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                             | Description                                                                 |
| ------ | -------------------------------- | --------------------------------------------------------------------------- |
| `GET`  | `/api/admin/usage-limits`        | Get current global usage limits and current daily/monthly budget status     |
| `GET`  | `/api/admin/usage-limits/review` | Get policy calibration, enforcement pressure, and limit-change audit events |
| `PUT`  | `/api/admin/usage-limits`        | Update global usage limits and record a durable audit event                 |

Update body:

```json
{
  "maxMessagesPerUserPerDay": 25,
  "maxTokensPerUserPerDay": 100000,
  "dailyBudgetUsd": "10",
  "monthlyBudgetUsd": "300",
  "rateLimitWindowSeconds": 60,
  "rateLimitMaxRequests": 100
}
```

---

## Telemetry (Admin)

**Controller**: `TelemetryController` (`packages/server/src/telemetry/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                   | Description                                                  |
| ------ | ---------------------- | ------------------------------------------------------------ |
| `GET`  | `/api/admin/telemetry` | List telemetry events (paginated: `?eventName&limit&cursor`) |

---

## Conversation Title Jobs (Internal)

**Controller**: `ConversationTitleJobsController` (`packages/server/src/conversation-titles/`)
**Auth**: `Authorization: Bearer <CRON_SECRET>`

| Method | Path                                           | Query           | Description                                       |
| ------ | ---------------------------------------------- | --------------- | ------------------------------------------------- |
| `GET`  | `/api/internal/jobs/conversation-titles/drain` | `?limit=number` | Claim and process pending conversation title jobs |

Response: `{ recovered: { requeued, failed }, claimed, completed, retried, failed, notClaimed }`

Errors: `401` when the bearer token is missing or invalid, `500` when `CRON_SECRET` is not configured, `400` for an invalid `limit`.

## Prompt Cache Jobs (Internal)

**Controller**: `PromptCacheJobsController` (`packages/server/src/prompt-cache/`)
**Auth**: `Authorization: Bearer <CRON_SECRET>`

| Method | Path                                      | Description                  |
| ------ | ----------------------------------------- | ---------------------------- |
| `GET`  | `/api/internal/jobs/prompt-cache/refresh` | Trigger prompt cache refresh |

Response: `{ status: 'refreshed' | 'partial' | 'skipped', warmed: ... }`

Errors: `401` when the bearer token is missing or invalid, `500` when `CRON_SECRET` is not configured.

## Knowledge Refresh Job

**Controller**: `KnowledgeJobsController` (`packages/server/src/knowledge/`)
**Auth**: `Authorization: Bearer <CRON_SECRET>`

| Method | Path                                   | Description                             |
| ------ | -------------------------------------- | --------------------------------------- |
| `GET`  | `/api/internal/jobs/knowledge/refresh` | Refresh all published knowledge sources |

---

## Admin Dashboard

**Controller**: `AdminController` (`packages/server/src/admin/`)
**Auth**: `requireActor(['admin'])`

| Method | Path         | Description              |
| ------ | ------------ | ------------------------ |
| `GET`  | `/api/admin` | Admin dashboard overview |

---

## Hono Typed Client

Frontend consumes the API via the Hono typed client:

```ts
// apps/web/src/lib/api/client.ts
import { hc } from 'hono/client';
import type { ApiRoutes } from '@eskwelabs-advisor/server';
export const apiClient = hc<ApiRoutes>('/').api;
```

Domain API functions use the typed client:

```ts
export function listAdvisors() {
  return apiClient.advisors.$get().then((r) => r.json());
}
export function createConversation(input: {
  advisorId: string;
  title?: string;
}) {
  return apiClient.conversations.$post({ json: input }).then((r) => r.json());
}
```

The `ApiRoutes` type is inferred from the return type of `ApplicationController.registerControllers()`.
