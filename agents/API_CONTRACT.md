# API Contract

All routes are registered at `packages/server/src/application.controller.ts` under `basePath('/api')`.

Common response envelope for errors:
```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Error codes: `forbidden` (403), `unauthorized` (401), `not_found` (404), `rate_limited` (429), `validation_failed` (400), `server_error` (500).

---

## Health & Info

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/` | None | Service info `{ status, name }` |
| `GET` | `/api/healthz` | None | Health check `{ status: 'ok' }` |

---

## Advisors

**Controller**: `AdvisorController` (`packages/server/src/advisors/`)
**Auth**: `requireAllowlistedEifOrAdmin`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/advisors` | List all advisors |

Response: `{ data: Advisor[] }`

---

## Users

**Controller**: `UsersController` (`packages/server/src/users/`)
**Auth**: `requireAllowlistedEifOrAdmin` on `/api/consent`, `requireActor(['admin'])` on admin routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/consent` | Acknowledge consent for current actor |
| `GET` | `/api/admin/users` | List all users (admin only) |

---

## Conversations

**Controller**: `ConversationController` (`packages/server/src/conversations/`)
**Auth**: `requireAllowlistedEifOrAdmin`

| Method | Path | Query / Body | Description |
|---|---|---|---|
| `GET` | `/api/conversations` | `?advisorId=string` | List conversations for current actor |
| `POST` | `/api/conversations` | `{ advisorId: string, title?: string }` | Create conversation |
| `GET` | `/api/conversations/:id` | — | Get conversation detail |

Response (list): `{ data: Conversation[] }`
Response (single): `{ data: Conversation }`

---

## Messages / Chat Turn

**Controller**: `MessageController` (`packages/server/src/messages/`)
**Auth**: `requireAllowlistedEifOrAdmin`

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/messages` | `?conversationId=uuid` | List messages in a conversation |
| `POST` | `/api/chat-turn` | `{ conversationId: uuid, content: string }` | Send a turn, get response |
| `POST` | `/api/chat-turn/stream` | `{ conversationId: uuid, content: string }` | SSE-streamed chat turn |

### Stream Events (`POST /api/chat-turn/stream`)

- `event: chunk` / `data: <string>` — partial content delta
- `event: final` / `data: { ... }` — complete response with usage
- `event: error` / `data: { error: { code, message } }` — error occurred

---

## Model Config (Admin)

**Controller**: `ModelConfigController` (`packages/server/src/model-config/`)
**Auth**: `requireActor(['admin'])`

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/admin/model-config` | — | List all model configs |
| `PUT` | `/api/admin/model-config/:advisorId` | `{ provider: string, model: string }` | Update model config for advisor |

---

## Prompt Cache (Admin)

**Controller**: `PromptCacheController` (`packages/server/src/prompt-cache/`)
**Auth**: `requireActor(['admin'])`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/prompt-cache` | List prompt cache entries |
| `POST` | `/api/admin/prompt-cache/refresh` | Refresh prompt cache |

---

## Usage Counters (Admin)

**Controller**: `UsageCounterController` (`packages/server/src/usage-counters/`)
**Auth**: `requireActor(['admin'])`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/usage-counters` | List usage counters |
| `GET` | `/api/admin/usage-users` | List usage by user |

---

## Telemetry (Admin)

**Controller**: `TelemetryController` (`packages/server/src/telemetry/`)
**Auth**: `requireActor(['admin'])`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/telemetry` | List telemetry events |

---

## Admin Dashboard

**Controller**: `AdminController` (`packages/server/src/admin/`)
**Auth**: `requireActor(['admin'])`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin` | Admin dashboard overview |

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
  return apiClient.advisors.$get().then(r => r.json());
}
export function createConversation(input: { advisorId: string; title?: string }) {
  return apiClient.conversations.$post({ json: input }).then(r => r.json());
}
```

The `ApiRoutes` type is inferred from the return type of `ApplicationController.registerControllers()`.
