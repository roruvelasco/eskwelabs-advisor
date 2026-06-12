# API Contract

All routes are registered at `packages/server/src/application.controller.ts` under `basePath('/api')`.

Common response envelope for errors:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Error codes: `forbidden` (403), `unauthorized` (401), `not_found` (404), `rate_limited` (429), `validation_failed` (400), `server_error` (500).

---

## Health & Info

| Method | Path           | Auth | Description                     |
| ------ | -------------- | ---- | ------------------------------- |
| `GET`  | `/api/`        | None | Service info `{ status, name }` |
| `GET`  | `/api/healthz` | None | Health check `{ status: 'ok' }` |

---

## Advisors

**Controller**: `AdvisorController` (`packages/server/src/advisors/`)
**Auth**: `requireActor(['eif', 'admin'])`

| Method | Path            | Description       |
| ------ | --------------- | ----------------- |
| `GET`  | `/api/advisors` | List all advisors |

Response: `{ data: Advisor[] }`

---

## Users

**Controller**: `UsersController` (`packages/server/src/users/`)
**Auth**: `requireActor(['eif', 'admin'])` on `/api/consent`, `requireActor(['admin'])` on admin routes

| Method  | Path                   | Body                                              | Description                                                     |
| ------- | ---------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `POST`  | `/api/consent`         | —                                                 | Acknowledge consent for current actor                           |
| `GET`   | `/api/admin/users`     | —                                                 | List all users (admin only)                                     |
| `POST`  | `/api/admin/users`     | `{ email: string, role: "eif" \| "admin" }`       | Create or reactivate user (admin only)                          |
| `PATCH` | `/api/admin/users/:id` | `{ role?: "eif" \| "admin", isActive?: boolean }` | Update user role/status (admin only, self-deactivation guarded) |

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

| Method   | Path                     | Query / Body                            | Description                          |
| -------- | ------------------------ | --------------------------------------- | ------------------------------------ |
| `GET`    | `/api/conversations`     | `?advisorId=string`                     | List conversations for current actor |
| `POST`   | `/api/conversations`     | `{ advisorId: string, title?: string }` | Create conversation                  |
| `GET`    | `/api/conversations/:id` | —                                       | Get conversation detail              |
| `DELETE` | `/api/conversations/:id` | —                                       | Delete conversation (owner-only)     |

Response (list): `{ data: Conversation[] }`
Response (single): `{ data: Conversation }`
Response (delete): `204 No Content`

**Auth (delete)**: `requireActor(['eif', 'admin'])` + `requireConsent()` | **Scope**: owner-only | **Errors**: `400` (invalid UUID), `404` (not found / not owner) | **Side effect**: messages for the conversation are deleted through DB cascade

---

## Messages / Chat Turn

**Controller**: `MessageController` (`packages/server/src/messages/`)
**Auth**: `requireActor(['eif', 'admin'])`

| Method | Path                    | Body                                        | Description                     |
| ------ | ----------------------- | ------------------------------------------- | ------------------------------- |
| `GET`  | `/api/messages`         | `?conversationId=uuid`                      | List messages in a conversation |
| `POST` | `/api/chat-turn`        | `{ conversationId: uuid, content: string }` | Send a turn, get response       |
| `POST` | `/api/chat-turn/stream` | `{ conversationId: uuid, content: string }` | SSE-streamed chat turn          |

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

---

## Prompt Cache (Admin)

**Controller**: `PromptCacheController` (`packages/server/src/prompt-cache/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                                                                         | Description                                      |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/admin/prompt-cache`                                                    | List legacy prompt cache metadata                |
| `POST` | `/api/admin/prompt-cache/refresh`                                            | Ingest prompt/DNA snapshots and warm Redis cache |
| `GET`  | `/api/admin/prompt-cache/advisors/:advisorId/snapshots`                      | List advisor prompt snapshot metadata            |
| `POST` | `/api/admin/prompt-cache/advisors/:advisorId/snapshots/:snapshotId/activate` | Roll back an advisor to a prior prompt snapshot  |
| `GET`  | `/api/admin/prompt-cache/dna-digests`                                        | List DNA digest metadata                         |
| `POST` | `/api/admin/prompt-cache/dna-digests/:digestId/activate`                     | Roll back to a prior DNA digest                  |

Prompt cache admin endpoints return metadata only. They never return advisor prompt text or DNA digest text. Refresh does not invalidate Redis first; it writes and warms new context and lets old keys expire naturally.

---

## Usage Counters (Admin)

**Controller**: `UsageCounterController` (`packages/server/src/usage-counters/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                        | Description         |
| ------ | --------------------------- | ------------------- |
| `GET`  | `/api/admin/usage-counters` | List usage counters |
| `GET`  | `/api/admin/usage-users`    | List usage by user  |

---

## Telemetry (Admin)

**Controller**: `TelemetryController` (`packages/server/src/telemetry/`)
**Auth**: `requireActor(['admin'])`

| Method | Path                   | Description           |
| ------ | ---------------------- | --------------------- |
| `GET`  | `/api/admin/telemetry` | List telemetry events |

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
