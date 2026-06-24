# Admin Functionality Checklist

## 0. Prerequisites

- [ ] `.env` has `PROMPT_PROVIDER_MODE=auto`
- [ ] Dev server restarted (`bun run dev`)
- [ ] Logged in as **admin** (not EIF user)

---

## 1. Dashboard (`GET /admin`)

- [ ] **Overview cards** load (Users, Models, Cache, Events counts)
- [ ] Sidebar navigation works (5 sections)
- [ ] Logout works

---

## 2. Usage (`GET /admin/usage-counters`)

- [ ] Usage counters list loads
- [ ] Filter by `userId`
- [ ] Filter by date range (`dayPh`)

---

## 3. Models (`GET /admin/model-config`)

- [ ] Model configs list per advisor loads
- [ ] **Edit** model config (provider + model) for an advisor
- [ ] `PUT /admin/model-config/:advisorId` — check response reflects new config
- [ ] Chat uses the new model config

---

## 4. Cache (`/admin/prompt-cache`)

- [ ] **Prompt cache list** loads (`GET /admin/prompt-cache`)
- [ ] **Refresh cache** button works (`POST /admin/prompt-cache/refresh`)
- [ ] After refresh, check snapshot versions updated
- [ ] **Snapshots per advisor** list loads (`GET /admin/prompt-cache/advisors/:advisorId/snapshots`)
- [ ] **Activate snapshot** — select a historical snapshot (`POST .../snapshots/:id/activate`)
- [ ] Chat uses the activated snapshot content
- [ ] **DNA digests list** loads (`GET /admin/prompt-cache/dna-digests`)
- [ ] **Activate DNA digest** — select a historical digest (`POST .../dna-digests/:id/activate`)
- [ ] Chat uses the activated DNA digest

---

## 5. Events (`GET /admin/telemetry`)

- [ ] Telemetry events list loads
- [ ] Filter by `eventName`

---

## 6. Users (`/admin/users`)

- [ ] Users list loads (`GET /admin/users`)
- [ ] Filter by `role` / `search`
- [ ] **Create user** — add a new EIF or admin user (`POST /admin/users`)
- [ ] **Update user** — toggle `isActive`, change `role` (`PATCH /admin/users/:userId`)

---

## 7. DNA Doc Propagation (end-to-end)

- [ ] Edit the shared DNA Google Doc
- [ ] `POST /admin/prompt-cache/refresh` → check DNA digest updated via Groq
- [ ] Send chat message → response reflects DNA doc changes (e.g., "speak like a caveman")
- [ ] Check `dna_digest_regenerated` telemetry event fires
