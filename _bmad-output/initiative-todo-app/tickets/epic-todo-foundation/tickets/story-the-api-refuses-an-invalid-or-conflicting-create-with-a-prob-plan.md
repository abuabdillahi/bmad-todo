---
title: 'The API refuses an invalid or conflicting create with a problem response'
type: feature
ticket: '3'
created: '2026-11-25'
status: built
baseline_revision: '4f16aa579b0fc13a17d5d14ced5a20097c45305b'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `POST /api/todos` uses Fastify's default Ajv (type coercion, unknown fields silently stripped), has no trim or control-character rule, no idempotent replay or 409, and every error is Fastify's own JSON shape. `/api/health` throws a 500 when storage fails, and nginx answers an HTML 502 when the API is down. The contract documents none of this.

**Approach:** Add AD-8's shared `description.ts` and the AD-9 `Problem` schema with all five type URIs to `packages/contract`. Make the API strict (Ajv overrides, a trimming `preValidation`), give it one error handler that renders every problem, a service-owned replay/409, and a 503 health answer. Add nginx's literal 503 `unavailable` problem for `/api/*`, document every error response in `openapi.json`, and cover U1, I2, I7 (unhealthy), I8, I9 (errors), I10 and I11 (create).

## Boundaries & Constraints

**Always:** Follow the spine: AD-4 (nginx 503 body byte-for-byte, `types {}` + `default_type application/problem+json`, upstream path unchanged), AD-5 (every schema in `packages/contract`, regenerate and commit `openapi.json`), AD-6 (POST `201` new, `200` replay with the same id and same trimmed description, `409` same id and different description; `503` documented on every route), AD-8 (Ajv `coerceTypes: false`, `removeAdditional: false` via `ajv.customOptions`; trim with `String.prototype.trim` in `preValidation`; 1–200 code points and pattern `^[^\p{Cc}\u2028\u2029]*$` built from the `u`-flag literal's `source`; store the trimmed value; never normalise), AD-9 (`{ type, title, status, detail, errors?: [{ field, message }] }`, `field` the bare property name, one error handler, no stack, SQL or todo text in any problem), AD-10 (service owns replay and conflict and imports nothing from Fastify; health calls `repository.ping()`), AD-15 (each write one statement), AD-19 (no todo text in logs at `info` or below), AD-20 (I7 unhealthy closes the db handle; test titles start with their scenario id).

**Never:** Client failure classification, `FailureKind`, `messages.ts`, announcer (story 5). Client description cleaning, inline messages or any web change (story 4). PATCH/DELETE routes (epic 2). Config validation changes, new security headers, log rotation, request ids (story 7). Editing a merged migration. Test-only code paths in app code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Create, padded | `{id, description: "  Buy milk\n"}` | `201`, stored and returned as `"Buy milk"` | — |
| Replay | same `id`, description equal after trim | `200` with the stored todo; still one row | — |
| Conflict | same `id`, other description | `409` `/problems/conflict`; stored row unchanged | detail names no todo text |
| Invalid create | empty or whitespace-only, 201 code points, unknown field, `null`, `description: 123`, bad uuid, missing field, malformed JSON | `400` `/problems/validation`, `application/problem+json`, `errors[].field` names the property when there is one | nothing stored |
| Control character | trimmed text still holds `\n`, `\r`, `\t`, `\u0000`, `\u007f`, `\u0085`, U+2028 or U+2029 | `400` validation, `errors` names `description` | nothing stored, never normalised |
| Injection | `<script>alert(1)</script>`, `'); DROP TABLE todos;--` | `201`; list returns the exact text; table intact | — |
| Storage down | db handle closed | `GET /api/health` → `503` `/problems/unavailable` | — |
| API down | test profile up, `api` stopped | `/api/*` via nginx → `503`, `application/problem+json`, AD-4's literal body | never HTML |
| Unknown route / bug | `GET /api/nope`; any thrown non-domain error | `404` `/problems/not-found`; `500` `/problems/internal` | no stack or SQL |

</intent-contract>

## Code Map

- `packages/contract/src/{todo,health,index}.ts` -- TypeBox 1.x (`import Type from 'typebox'`). `CreateTodoBody.description` is a bare `minLength 1 / maxLength 200` string today. `package.json` `exports` has only `.` and `./openapi.json`; deps only `typebox`.
- `apps/api/src/app.ts` -- `buildApp({ config, db })`; `Fastify({ logger })` with no `ajv` option; swagger `openapi: '3.1.0'`; routes registered under prefix `/api`.
- `apps/api/src/routes/todos.ts` -- POST returns `reply.code(201).send(service.create(request.body))`; response schemas only `201`/`200`.
- `apps/api/src/routes/health.ts` -- calls `repository.ping()` unguarded.
- `apps/api/src/todos/service.ts` -- `create` passes straight to `repository.create`; `sortNewestFirst` (U2) stays.
- `apps/api/src/todos/repository.ts` -- `list`, `create` (insert … returning, one statement), `ping`. The only Drizzle user beside `src/db/`.
- `apps/api/src/todos/service.test.ts` -- U2's fake `TodoRepository` must gain any new repository method.
- `apps/api/scripts/gen-openapi.ts` -- `renderOpenApi()` / `openApiPath`; `pnpm gen:openapi` writes `packages/contract/openapi.json`.
- `apps/api/test/integration/{harness,todos,health,openapi}.test.ts` -- `startHarness()` gives `{ app, db, close }`; `openapi.test.ts` asserts the committed file equals the generated one and the path keys.
- `apps/api/test/contract/todos.contract.test.ts` -- Ajv2020 + ajv-formats against `E2E_BASE_URL`; `call()` asserts `application/json` and `contractSchema()` reads only `application/json` content. Both need to handle `application/problem+json`.
- `apps/web/nginx.conf` -- `location /api/` with a variable `proxy_pass $api_upstream` and `resolver 127.0.0.11 valid=5s`. Server-level `add_header … always` lines must stay inherited (no `add_header` inside a location).
- `vitest.config.ts` -- projects `unit` (`packages/*/src/**/*.test.ts` included), `component`, `integration`, `contract`.
- `scripts/test-all.mjs` -- runs unit/component/integration with coverage, then `contract`, then e2e, then `scenario-coverage.mjs`; always `down -v`.
- `scripts/scenario-coverage.mjs` -- reads `coverage/contract-report.json` (Vitest JSON) and `coverage/e2e-report.json`; exits 1 when a report is missing.
- Unchanged: `apps/web/**` except `nginx.conf`, `compose.yml`, `apps/api/drizzle/**`, `src/config.ts`.
- Toolchain: prefix commands with `export PATH=~/.nvm/versions/node/v26.13.1/bin:$PATH`. `ajv@8.20.0` and `ajv-formats@3.0.1` are already in the lockfile.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contract/src/description.ts` -- dependency-free: `FORBIDDEN_CHARACTER = /[\p{Cc}\u2028\u2029]/u`, `DESCRIPTION_MIN_LENGTH = 1`, `DESCRIPTION_MAX_LENGTH = 200`, `DESCRIPTION_PATTERN` (`^[^…]*$` from the literal's `source`), and `checkDescription(trimmed)` returning `'empty' | 'too-long' | 'forbidden-character' | null`, counting `[...s].length` -- AD-8, the one runtime import story 4 makes
- [x] `packages/contract/src/{problem,todo,index}.ts`, `package.json` -- `PROBLEM_TYPES` (the five `/problems/*` strings), `ProblemType`, `Problem` schema (`status` integer, `errors` optional array of `{ field, message }`, `additionalProperties: false`); `Description` schema from `description.ts` used by `CreateTodoBody`; export `./description` in `package.json`; add `ajv` 8.20.0 as a devDependency for U1 -- AD-5/8/9
- [x] `packages/contract/src/description.test.ts` -- U1: one case table, each case trimmed then run through Ajv (API options) on the `Description` schema and through `checkDescription`; both must agree with the expected verdict. Cases per test-strategy U1, including 200 single-code-point emoji, every control character in the matrix, and a text with `p`, `c`, `C`, `{`, `}` -- U1
- [x] `apps/api/src/errors.ts` -- `ConflictError`, `UnavailableError`, `NotFoundError`; no Fastify import -- AD-10
- [x] `apps/api/src/problems.ts` -- one error handler plus a not-found handler that throws `NotFoundError`. It maps Fastify validation errors and other 4xx client errors (bad JSON, empty body, wrong media type) to `400` validation with `errors[].field` (from `instancePath`, `missingProperty` or `additionalProperty`) and fixed messages; the domain errors to `409`/`503`/`404`; anything else to `500` internal, logged at `error`. It sets `application/problem+json`. Titles and details are fixed strings, with the unavailable detail equal to nginx's -- AD-9
- [x] `apps/api/src/app.ts` -- `ajv: { customOptions: { coerceTypes: false, removeAdditional: false } }`; register the handlers -- AD-8/9
- [x] `apps/api/src/routes/{todos,health,problem-responses}.ts` -- shared `problem+json` response entries; POST has a `preValidation` that trims a string `description`, answers `201`/`200` from the service result, and documents `200, 201, 400, 409, 500, 503`; GET todos `200, 500, 503`; health `200, 500, 503` and throws `UnavailableError` when `ping()` throws -- AD-6/8
- [x] `apps/api/src/todos/{repository,service}.ts`, `service.test.ts` -- `repository.findById(id)`; `service.create` returns `{ todo, created }`: an existing id with an equal description replays, a different one throws `ConflictError`; update U2's fake -- AD-6/10
- [x] `packages/contract/openapi.json` -- `pnpm gen:openapi`, committed -- AD-5
- [x] `apps/web/nginx.conf` -- `error_page 502 503 504 = @api_unavailable;` in `/api/`, plus `proxy_connect_timeout 5s`; a named location that returns AD-4's literal body with status 503. Do not set `proxy_intercept_errors`, so the API's own problems pass through -- AD-4
- [x] `apps/api/test/openapi-schema.ts` -- shared Ajv2020 + formats instance, `contractSchema(path, method, part, mediaType)` and `expectValid`, used by the contract and integration tests -- I9
- [x] `apps/api/test/integration/{todos,health,openapi}.test.ts` -- I2, I8 (create and list), I10, I11 (create half) per the matrix, each checking problem shape, content type and the stored rows; I7 unhealthy (a separate harness whose db handle is closed) with its 503 validated against `openapi.json` (I9); `openapi.test` asserts every operation documents `503` as `application/problem+json` -- I2/I7/I8/I9/I10/I11
- [x] `apps/api/test/contract/todos.contract.test.ts` -- I9 for the 400 problem, the 200 replay and the 409 problem, each validated against its documented status and media type -- I9
- [x] `apps/api/test/unavailable/api-down.contract.test.ts`, `vitest.config.ts` -- new Vitest project `contract-unavailable`. Poll `/api/health` until it answers 503, for up to 30 s, then check that GET `/api/todos`, POST `/api/todos` and GET `/api/health` through `E2E_BASE_URL` each answer `503`, `application/problem+json` and AD-4's exact body, valid against that route's documented 503 -- I9, AD-4
- [x] `scripts/test-all.mjs`, `scripts/scenario-coverage.mjs` -- give unit, component and integration a Vitest JSON report too. After e2e, `docker compose … stop api`, then run `contract-unavailable` with its own JSON report, skipped when todo-test did not start. `scenarios.md` lists every report's scenario ids by suite, so U1, I2, I7, I8, I10 and I11 appear -- R17, R18, story Verify

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm test:all` runs, then it exits 0 and `coverage/scenarios.md` shows passing tests for U1, I2, I7, I8, I9, I10 and I11.
- Given the test profile is up and the `api` container is stopped, when `curl -i http://127.0.0.1:8081/api/todos` runs, then it answers 503 with `Content-Type: application/problem+json` and AD-4's JSON body, not HTML.
- Given `openapi.json` is regenerated, when it is diffed, then there is no change, and every operation documents `503` `application/problem+json` against the `Problem` schema.
- Given any 4xx or 5xx response from the API, when its body is read, then it has no stack, no SQL and none of the submitted todo text.

## Implementation Notes

- `Problem.type` lists the five literals by index from `PROBLEM_TYPES`: `Type.Union(PROBLEM_TYPES.map(Type.Literal))` makes the static type `never`. @fastify/swagger renders each `const` as a one-item `enum`.
- Fastify appends `; charset=utf-8` to the API's `application/problem+json`; nginx's 503 has no parameter. Tests match the media type by prefix, except the unavailable suite, which checks nginx's exact header.
- POST's `200` and `201` use the media-type-keyed form too, so openapi.json describes the replay and the create separately.
- 4xx problems are not logged. `UnavailableError` logs at `warn`, anything unexpected at `error`.
- The `stop api` step in `test-all.mjs` counts towards the exit code.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 3 findings — high 0, medium 1, low 2, false 0, maybe-false 0
- findings:
  - `medium` `patch` A malformed URL (e.g. `GET /api/todos%E0%A4%A`) skips the error handler, so Fastify answers its own `application/json` error shape, echoing the path (AD-9) — confirmed: `fastify.js:680` calls `options.frameworkErrors` only when set, and `buildApp` set none. Fix: `frameworkErrors` in `apps/api/src/app.ts` delegates to `problemErrorHandler`, plus an I9 integration test for a 400 `/problems/validation` problem.
  - `low` `patch` The I2 "a non-JSON media type" case sent `text/plain`, which Fastify parses by default, so the unsupported-media-type branch went untested — confirmed: `content-type-parser.js:38` registers a `text/plain` parser. Fix: the case now sends `application/xml`.
  - `low` `reject` nginx's own 4xx responses under `/api/` (e.g. the 413 for a body over 1m) are still HTML — real, but AD-4 scopes nginx's problem to upstream failures (502/503/504), and the app's client never sends a body near 1 MB (200 code-point limit). The fix would add new nginx error mappings and a status-to-type choice, which is more than a direct correction.

## Design Notes

- Response schemas keyed by media type (`{ description, content: { 'application/problem+json': { schema: Problem } } }`) let `@fastify/swagger` document problems truthfully and let Fastify serialize them. Check the generated document and the serializer pick them up.
- Ajv counts code points for `minLength`/`maxLength` and compiles `pattern` with the `u` flag by default, so the schema and `checkDescription` agree. U1 proves both.
- Replay is find-then-insert in the service. better-sqlite3 is synchronous and the API is the only writer (AD-2), so no request interleaves between the two steps, and the insert stays one statement (AD-15).
- The unavailable suite runs after e2e, with `api` stopped and `web-test` still up. nginx re-resolves within 5 s and a stopped container's name no longer resolves, so it answers 502 internally and `error_page` turns that into the 503 problem.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm exec vitest run --project unit --project integration` -- expected: all pass, including U1, I2, I7, I8, I9, I10, I11
- `pnpm gen:openapi && git diff --exit-code packages/contract/openapi.json` -- expected: no diff once committed
- `pnpm test:all` -- expected: exit 0; `coverage/scenarios.md` lists U1, I2, I7, I8, I9, I10, I11 as pass, and the `contract-unavailable` step passed

## Auto Run Result

**Summary:** `POST /api/todos` now validates strictly (no coercion or stripping, a trimmed description of 1–200 code points with no control or separator characters). It replays an identical create as `200` and refuses a conflicting one with `409`. Every API error is an RFC 9457 problem from one error handler, `/api/health` answers a `503` unavailable problem when storage fails, and nginx answers AD-4's literal `503` problem when the API is down. All of it is documented in the regenerated `openapi.json`.

**Files changed:**
- `packages/contract/src/description.ts` -- AD-8's shared rule: `u`-flag class, limits, pattern, `checkDescription`
- `packages/contract/src/description.test.ts` -- U1 case table through Ajv and `checkDescription`
- `packages/contract/src/problem.ts` -- `PROBLEM_TYPES`, `Problem`, `ProblemFieldError`
- `packages/contract/src/{todo,index}.ts`, `package.json`, `tsconfig.json` -- `Description` schema, `./description` export, `ajv` devDependency, vitest globals
- `packages/contract/openapi.json` -- regenerated with every error response
- `apps/api/src/errors.ts` -- domain errors with no Fastify import
- `apps/api/src/problems.ts` -- the one error handler and the not-found handler
- `apps/api/src/app.ts` -- Ajv overrides, `frameworkErrors`, the handlers registered
- `apps/api/src/routes/{todos,health,problem-responses}.ts` -- trimming `preValidation`, `201`/`200`, documented problems, health `503`
- `apps/api/src/todos/{repository,service,service.test}.ts` -- `findById`, replay and conflict in the service
- `apps/web/nginx.conf` -- `@api_unavailable` named location, `proxy_connect_timeout 5s`
- `apps/api/test/openapi-schema.ts` -- shared Ajv2020 contract helper
- `apps/api/test/integration/{todos,health,openapi}.test.ts` -- I2, I7 (unhealthy), I8, I9, I10, I11
- `apps/api/test/contract/todos.contract.test.ts` -- I9 for 400, 409 and the 200 replay
- `apps/api/test/unavailable/api-down.contract.test.ts`, `vitest.config.ts` -- `contract-unavailable` project
- `scripts/test-all.mjs`, `scripts/scenario-coverage.mjs` -- JSON reports for every layer, the `stop api` and unavailable steps
- `pnpm-lock.yaml` -- `ajv` devDependency for the contract package

**Review findings:** 2 patches applied (1 medium: `frameworkErrors`; 1 low: the media-type test case). None deferred. 1 rejected: nginx's own 4xx pages are HTML, which is outside AD-4's upstream-failure scope and unreachable from the app's client.

**Follow-up review recommended:** false (patched: high 0, medium 1, low 1).

**Verification:** `pnpm typecheck` passes. `vitest run --project unit --project integration` passes all 67 tests. `pnpm gen:openapi` gives no diff. `pnpm test:all` exits 0 with every step passed, including `stop api` and `contract-unavailable`, and `coverage/scenarios.md` shows U1 (20), I2 (11), I7 (2), I8 (4), I9 (16), I10 (2) and I11 (13) passing.

**Residual risks:**
- The API's problems carry `Content-Type: application/problem+json; charset=utf-8`, while nginx's carry none. Story 5's client must match on the media type only.
- Fastify's Ajv stops at the first error, so `errors` names at most one field.
- With storage down, GET `/api/todos` answers `500` internal, not `503`.
- nginx's own 4xx pages (413, 400) are still HTML (rejected finding).
