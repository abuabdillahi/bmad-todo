---
type: architecture-review
lens: adversary
target: _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md
reviewed: '2026-11-23'
inputs: [tickets/tickets.toml, tickets/epic-todo-foundation/epic-todo-foundation.md, tickets/epic-manage-todos/epic-manage-todos.md, initiative-todo-app.md, test-strategy.md]
verdict: 'Not yet a safe build substrate. 11 major holes, 14 minor ones'
---

# Adversarial review: Todo App v1 spine

**Lens.** Build two units one level down (epic 1 vs epic 2, or stories inside them, such as API vs web, Docker vs CI, or harness vs feature). Each unit follows every AD to the letter, and the pair still builds incompatibly. Each pair found is a hole, and each comes with a proposed new or tightened AD.

**Verdict: needs revision before epic refinement.** The spine settles the big decisions well. Most holes sit at the seams the spine names but does not pin down: compose topology, proxy path handling, PATCH and POST body semantics under Fastify's default Ajv, the optimistic helper's scope, settle and rollback mechanics, error bodies that do not come from `api`, and test isolation. Two holes are contradictions inside the spine itself (M7: AD-6 vs AD-9; M1: the AD-16 profile table vs how compose works). These would bite in epic 1 before epic 2 even starts.

Severity: **Major** means two compliant units fail at runtime, in CI or in deploy, or silently corrupt state. **Minor** means drift, rework or inconsistent UX, with no break.

---

## Major

### M1. Compose topology: service names, per-profile variants and volumes are not implementable as written

- **Unit A (epic 1, Docker/compose story):** Compose allows one definition per service name. So the story writes `api-dev`, `api-test` and `api` (prod) to get "watch mode with source mounted" in `dev`, built images in `test`, GHCR images in `prod`, and "each profile has its own named data volume" (AD-16, profile table).
- **Unit B (epic 1, CI / harness / I6 story):** The profile table says `api` is in every profile, so this story runs `docker compose --profile test restart api` for I6, waits on `api` healthy, and resets with `docker compose --profile test down -v`. The deploy story runs `up -d --wait` for project `todo`.
- **Both comply because** the AD-16 table lists `api` under all three profiles with different build modes and volumes, which one compose service cannot be. The spine never says how per-profile variation is expressed (distinct names, `${VAR}` interpolation, `extends`) or which compose project names `dev` and `test` use. A checkout in a directory named `todo` defaults to project `todo`, the same name as prod, and `dev` and `test` then share one project, so `down -v` or `--remove-orphans` from the test run can delete dev containers or volumes.
- **Proposed AD fix:** Add a compose topology table to AD-16 that fixes every service name per profile (e.g. `api`/`web` for test and prod, `api-dev`/`web-dev` for dev), how the image and volume vary (`${IMAGE_TAG}`, `${DATA_VOLUME}`), and a distinct project name per environment (`todo-dev`, `todo-test`, `todo`), set via `name:` or `-p` in the scripts.

### M2. The `/api` prefix and internal ports: the nginx proxy and the Vite proxy disagree, and nothing fixes ports or env names

- **Unit A (epic 1, web image / nginx story):** `location /api/ { proxy_pass http://api:3000/; }`. The trailing slash strips `/api`, so `api` receives `/todos`. Healthcheck `/healthz`, listening on 8080 (the nginx-unprivileged default).
- **Unit B (epic 1, API story):** Registers routes under `/api/todos` and `/api/health` (AD-6 names those paths), listens on `PORT=8080` from env. The dev story's Vite proxy forwards `/api` unchanged to `http://api:3000`.
- **Both comply because** AD-4 says only "web proxies `/api/*` to `api`". It never says whether the prefix is kept, which port `api` listens on, which port `web` listens on (which the cloudflared ingress and the Playwright `baseURL` both need), or what any env var is called. `.env.example` "lists every variable" but nobody owns the names. So dev works and test/prod return 404, or the reverse.
- **Proposed AD fix:** Add to AD-4/AD-16 that `api` mounts every route under the `/api` prefix itself and that every proxy forwards the path unchanged, plus a fixed table of internal ports (`api:3000`, `web:8080`) and env var names (`PORT`, `DATABASE_PATH`, `APP_ENV`, `LOG_LEVEL`, `TUNNEL_TOKEN`, `IMAGE_TAG`, `API_PROXY_TARGET` for Vite).

### M3. A per-id mutation `scope` cannot cover create, so PATCH/DELETE can overtake a pending POST

- **Unit A (epic 1, optimistic add hook):** One `useMutation` in the add form. In TanStack v5 the `scope` comes from the hook's options when the hook renders, not from each `mutate()` call. The id is minted in the submit handler, after render, so the hook uses `scope: { id: 'create' }` or no scope.
- **Unit B (epic 2, toggle/delete hooks):** `useMutation({ scope: { id: todo.id } })` inside each item, exactly as AD-13 says.
- **Both comply because** AD-13 states the goal ("never overtakes that todo's pending POST") but not the scope key or how create obtains it. A user who adds and then immediately ticks or deletes the new item (E2/E3 do this) sends a PATCH that races the POST. The PATCH gets `404`, rolls back and announces a failure, and the POST then lands.
- **Proposed AD fix:** AD-13 sets every todo mutation, create included, to `scope: { id: 'todo:' + id }`. Create mints the id before the mutation is built (e.g. a per-submit `queryClient.getMutationCache().build` or a draft id held in state), or the spine picks one global `scope: { id: 'todos' }` that serializes all writes. Either way the choice is written into the AD.

### M4. POST retry after a lost response: `409` is treated as failure and rolls back a todo that was saved

- **Unit A (epic 1, API create story):** Any existing id returns `409` (AD-6, AD-7).
- **Unit B (epic 1 harness or epic 2 error-handling story):** Enables mutation `retry` for network errors (TanStack lets you set it; E6 tests "unreachable"), or the user retries. The shared helper treats every non-2xx as failure, so it rolls back, announces "couldn't save", and then the invalidation refetch makes the todo reappear.
- **Both comply because** the spine makes the id client-minted precisely so retries are safe, but it never says that a retried identical POST is a success. AD-13 does not say whether mutations retry at all.
- **Proposed AD fix:** AD-7: a POST whose `id` already exists with the same trimmed `description` returns `200` with the stored `Todo` (idempotent replay). `409` is only for an id that exists with different content. AD-13 sets mutation `retry` explicitly (e.g. retry only network errors, at most 2 times, never 4xx).

### M5. PATCH/POST body semantics under Fastify's default Ajv: coercion, stripped unknowns, `null`, and full vs partial bodies

- **Unit A (epic 1, API skeleton):** Fastify defaults (`coerceTypes: 'array'`, `removeAdditional: true`) and TypeBox `Type.Object` (additional properties allowed). `{completed: null}` is coerced to `false`, `{completed: "true"}` to `true`, `{description: 123}` to `"123"`, and POST `{…, completed: true}` is quietly accepted as `false`.
- **Unit B (epic 2, PATCH story and I4/I9 tests):** `additionalProperties: false`, `minProperties: 1`, and negative tests that expect `400` for `null`, strings and unknown keys. They get `200`. Separately, the epic 2 edit hook sends the full `{description, completed}` from the cache snapshot taken at mutate time. If a queued toggle before it fails and rolls back, the edit re-applies the failed completion on the server.
- **Both comply because** AD-6 says only `{ description?, completed? }` (at least one). It never says whether unknown keys are rejected or stripped, whether `null` is allowed, whether types coerce, or whether clients send only the changed fields.
- **Proposed AD fix:** AD-5/AD-6: Fastify's Ajv runs with `coerceTypes: false` and `removeAdditional: false`. Every body schema has `additionalProperties: false` (unknown key returns `400`). `null` is never valid. PATCH needs at least one of the two known keys. Clients send only the fields they change.

### M6. Trim vs schema length, and code points vs code units: client and server disagree on what is valid

- **Unit A (epic 1, POST route schema):** `description: Type.String({ minLength: 1, maxLength: 200 })`. AD-8 says "maxLength comes from the contract", so it must be on the route schema, where Ajv checks it **before** the service trims and counts **Unicode code points**. A 199-char text with two spaces on each side is `400`. The `errors[].field` comes from Ajv as `/description` (instancePath).
- **Unit B (epic 1 add form / epic 2 edit form):** The client pre-check follows AD-8 exactly: trim, then `1 ≤ s.length ≤ 200` (**UTF-16 code units**), then show `errors[]` where `field === 'description'`. The padded text passes the client and fails the server. 150 emoji are rejected by the client and accepted by Ajv. Server field errors never attach to the input.
- **Both comply because** AD-8 says "trims then requires 1–200 characters" but does not say "characters" means code points, does not say where the route schema's limit applies relative to the trim, and does not fix the format of `errors[].field`.
- **Proposed AD fix:** AD-8: length is counted in Unicode code points after trimming. The route schema carries only `maxLength` plus a slack margin (or the trim happens in a preValidation hook so the schema sees trimmed text). The client uses `[...s.trim()].length`. AD-9: `errors[].field` is the bare JSON property name (`description`), never a JSON pointer.

### M7. Error bodies that are not problem+json, and error semantics the client cannot act on

- **Unit A (epic 1, health story):** `503 {status:"unavailable"}` exactly as AD-6 says. nginx keeps its default HTML 502/504 pages when `api` is down. The Cloudflare edge returns HTML 52x pages.
- **Unit B (epic 1, error handler + I9 contract test / web API client):** AD-9 says "every non-2xx response from `api` is `application/problem+json`". The contract test asserts that for every 5xx, so the health 503 fails it. The web client parses every non-2xx as a problem and reads `detail`, then crashes or announces nothing on nginx's HTML 502. That is exactly the E6 "API unreachable" case.
- Related pair: **epic 2 delete hook** treats `404` (todo already gone, e.g. deleted in another tab) as failure, rolls back and resurrects it, then the refetch removes it again, along with a false "couldn't delete" announcement. AD-9 gives no `type` catalogue, so the client cannot tell a not-found apart from a route miss.
- **Both comply because** AD-6 and AD-9 contradict each other on `/api/health`, AD-9 covers only responses "from `api`", and no AD says who defines `type` URIs or what `404` on DELETE means to the client.
- **Proposed AD fix:** AD-9: list a closed catalogue of `type` URIs in the contract (`/problems/validation`, `/problems/not-found`, `/problems/conflict`, `/problems/internal`, `/problems/unavailable`), make the health `503` a problem with a `status` extension (or exempt it explicitly), have nginx return a problem+json `502/503/504` for `/api/`, and say the client treats any non-problem error body as a network failure and treats `404` on DELETE as success.

### M8. Test isolation: one shared list, no reset path, and integration tests whose target is unspecified

- **Unit A (epic 1, harness story):** Runs Playwright with its default parallel workers against the single shared list. Integration tests use `fastify.inject()` in-process with a temp SQLite file (so v8 coverage works), and contract tests do the same. Because AD-16 allows branching on validated config, it adds `POST /api/test/reset` behind `APP_ENV=test`.
- **Unit B (epic 2, E5 empty-state test / contract regen / I6):** E5 needs an empty list, but epic 1's E1 todos exist and another worker is adding more. The test-only route shows up in `openapi.json` only when generated with `APP_ENV=test`, so the AD-5 regen-diff check flips depending on env. I6 ("restart the API container") cannot run through `inject()`. The test strategy says integration runs "against API and storage in the test profile", which means sharing the container DB with e2e, and AD-2 forbids touching that file.
- **Both comply because** the spine fixes only that `pnpm test:all` "brings up the test profile" and that the volume is "reset each run". It says nothing about per-test reset, worker parallelism, whether integration tests use `inject()` or the container, or whether test-only routes are allowed.
- **Proposed AD fix:** Add a test-isolation AD: integration tests run in-process via `inject()` on a fresh temp SQLite file per file. Contract tests (I9) and I6 run against the test-profile container. E2e runs with `workers: 1`, and each test clears the list through the public API (or each spec gets a freshly recreated stack). No test-only routes are registered in any `APP_ENV`, and the contract is always generated from production config.

### M9. Settle and rollback mechanics: invalidation flicker, snapshot rollback that clobbers concurrent changes, and an error state that hides the list

- **Unit A (epic 1, shared helper):** The canonical TanStack recipe. `onMutate` snapshots the whole `['todos']` list, `onError` restores the snapshot, and `onSettled` always calls `invalidateQueries(['todos'])`. There is no `cancelQueries`, and the server response is never written into the cache.
- **Unit B (epic 2, delete/toggle on other todos + list states):** While A's add for todo X is pending, a delete of todo Y is applied optimistically. The add fails, and the snapshot restore brings Y back. The add's settle refetch returns a list that still contains Y, because the DELETE has not committed, so Y flickers back. The K5 list renders its error state on `isError`. A failed mutation's settle refetch also fails (API down), so the whole list is replaced by the error state. That breaks R12 ("without losing the list").
- **Both comply because** AD-13 says "rolls back exactly that change" and "invalidates on settle", but not how either is done. AD-14/R9 do not say an error state needs the absence of data.
- **Proposed AD fix:** AD-13: `onMutate` cancels in-flight `['todos']` fetches. Rollback is an inverse operation keyed by todo id, not a snapshot restore. On success the server's `Todo` replaces the optimistic one. Invalidation runs only when no other todo mutation is pending. The list shows its error state only when the query has no data, and background-refetch failures go to the announcer.

### M10. The problem schema has no home in the contract, so epic 2 changes create/list's contract

- **Unit A (epic 1, POST/GET routes):** Inlines a problem schema per route under `application/json` (the Fastify default content type in the response schema). openapi-typescript then emits anonymous per-operation error types.
- **Unit B (epic 2, PATCH/DELETE routes):** Registers `addSchema({ $id: 'Problem' })` and references it under `application/problem+json`, then refactors epic 1's routes to match. That changes the committed contract for create and list, which epic 2's boundary forbids. If it doesn't refactor, the web client has two problem types and two content types to parse.
- **Both comply because** AD-9 says only "the contract documents the schema for every error response". It doesn't say whether the schema is shared, under which name or content type, or how @fastify/swagger names components.
- **Proposed AD fix:** AD-9: one `Problem` schema (and `ValidationProblem`), registered once in epic 1's tracer with a stable `$id` and swagger component name, referenced by every route for every documented 4xx/5xx under `application/problem+json`.

### M11. "Tested images run in prod": CI builds one artifact, and deploy builds another

- **Unit A (epic 1, CI story, `ci.yml`):** `docker compose --profile test build` on the runner, runs `pnpm test:all`, discards the images.
- **Unit B (epic 1, deploy story, `deploy.yml`, a separate workflow per the source tree):** Triggered by green `main`, it runs `docker build` again on a fresh runner and pushes `:<sha>` (AD-18 says "that deploy pushes" the images).
- **Both comply because** AD-18 assigns the push to the deploy and tags by SHA. Same SHA, different build (base-image drift, non-reproducible layers), which breaks AD-1's intent while following the letter of every AD. Also, no AD says how limber gets the matching `compose.yml` or how `IMAGE_TAG` reaches the host `.env`.
- **Proposed AD fix:** AD-18: CI builds each image once per push, pushes `:<sha>` to GHCR before tests, and the test profile runs those exact digests. Deploy only promotes (pull by digest), copies `compose.yml` at that SHA to limber, and writes `IMAGE_TAG=<sha>` into the host `.env`.

---

## Minor

1. **Ordering tie-break direction and who sorts.** AD-6 says "then `id`" but not asc or desc. AD-10 gives "ordering" to the service, while only the repository touches SQL, so the service sorts in JS while the repository adds `ORDER BY`, two sorters. Fix: the repository orders with `ORDER BY created_at DESC, id DESC`, the service does not re-sort, and U2 is a repository or integration test.
2. **The client re-sorts on a fabricated `createdAt`.** The optimistic add must invent `createdAt` (the `Todo` type requires it) from the client clock. If an epic 2 list component sorts by `createdAt`, clock skew reorders items after the refetch. Fix: the client never sorts. Optimistic add prepends, and the server order is authoritative.
3. **What the optimistic item shows.** One hook inserts the raw input and another inserts the trimmed input. Fix: the client trims before the optimistic insert (same rule as AD-8).
4. **Wire/storage conversion owner.** The repository could return `Date` (Drizzle `timestamp_ms`), an epoch number or an ISO string. The route serializer then emits `"1763…"` for a number. Fix: the repository maps rows to the wire `Todo` (ISO string, boolean `completed`), and `createdAt` is set in the repository with `Date.now()`, not a SQL default (`unixepoch()` drops milliseconds).
5. **`completed` column mode.** Drizzle `integer({mode:'boolean'})` vs a raw integer. One epic writes `true` and the other compares `=== 1`. Fix: the data seed names the Drizzle column mode.
6. **Migration immutability.** Nothing forbids epic 2 editing epic 1's `0000_*.sql`, which is already applied in prod and is skipped there. Fix: migrations are immutable once on `main`, and each epic adds new ones.
7. **Undocumented `400` on DELETE.** If DELETE reuses a shared `format: uuid` params schema, it returns `400`, which AD-6 doesn't list. Uppercase UUIDs pass Ajv but create case-distinct rows. Fix: one shared params schema, `400` listed for PATCH and DELETE, ids normalized to lowercase (or rejected if not lowercase).
8. **Announcer wording ownership.** AD-14 makes server `detail` strings user-facing copy, so Ajv text like "must NOT have more than 200 characters" reaches users, and an unexpected error's `err.message` (e.g. `UNIQUE constraint failed: todos.id`) can leak SQL. Fix: the web owns all user-facing wording, keyed by problem `type` and field, and the server's `detail` is for developers.
9. **Success announcements and politeness.** Whether success ("Todo added") is announced, and whether the region is polite or assertive, is unowned, so epics 1 and 2 will differ. Fix: AD-14 lists the message set and `aria-live="polite"`.
10. **Lost user input on server rejection.** K1 clears the form on submit, and a server `400` then rolls back the optimistic item, so the typed text is gone. Epic 2's edit may keep or close edit mode. Fix: on rollback the hook returns the rejected text to the originating input (or the form clears only on success).
11. **cloudflared health.** AD-17 says "every image declares a HEALTHCHECK", but the distroless cloudflared image has neither `wget` nor `node`. `--wait` semantics then differ. Fix: scope AD-17 to repo-built images and use cloudflared's `--metrics` `/ready` endpoint or none.
12. **Health probe target.** The web container HEALTHCHECK might hit static `/healthz` or proxied `/api/health`, and `depends_on` chains differ as a result. Fix: `/healthz` is static nginx and never proxies.
13. **MSW fixtures.** Component-test handlers hand-write `Todo` and problem shapes, against the spirit of AD-5. Fix: one fixture factory typed from `packages/contract`, owned by the tracer story.
14. **Request id and log redaction.** No AD says whether nginx forwards `X-Request-Id`, or that pino redacts `req.body`. A validation-error log at `error` level can include todo text. Fix: AD-17 sets request-id propagation and pino `redact: ['req.body', 'res.body']`.

---

## Notes

- The epics still say "tentatively on Cloudflare" and hold Cloudflare open questions that AD-1/AD-3 have settled. That is not a spine hole, but the epic files should be updated so story authors don't build against the old host.
- Several fixes (M3, M5, M6, M9) belong in epic 1's tracer story, because epic 2's boundary forbids changing create/list behaviour or contract later.
