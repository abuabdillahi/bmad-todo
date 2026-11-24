# Review — reconcile spine against test strategy and quality/infra notes

- Spine: `architecture-todo-app/architecture-todo-app.md` (draft, 2026-11-23)
- Inputs: `test-strategy.md`, `notes-quality-infra.md` (qi T1–T5, D1–D4, Q1–Q4)
- Date: 2026-11-23
- Question asked: can every layer, scenario, report and note be built and run under the spine's rules as written, and would two builders solve it the same way?

## Verdict

**Revise before stories start.** The spine fixes the product path well (AD-6 to AD-15), but the test path is mostly implied by one Conventions row and one "One command" row. As written:

- 2 scenarios cannot be built: I7 (unhealthy branch) and E6 (no defined way to make the API fail, and the obvious way breaks other things).
- The spine contradicts itself in 2 places that tests will hit: the health `503` body (AD-6 vs AD-9), and SQL in the health route (AD-17 vs AD-10).
- The compose layout in the profile table can't be written as one `compose.yml` (same service names with different configs in `dev` and `test`).
- About 10 scenarios are ambiguous enough that two builders would produce incompatible harnesses. The causes are where integration and contract tests run, how e2e state is isolated, how component tests stub the API, and who owns the validation message.
- Coverage "per layer" (R18) can't be produced for contract and e2e as the spine runs them, and the spine doesn't say what replaces it.
- The MCP tools in C9/C10 (Postman, Playwright, Chrome DevTools) and Lighthouse are not placed. The stack lists only the CI-runnable libraries, and it never says that these satisfy C9 and C10.

None of the fixes changes the paradigm. They are about eight short additions: one new AD for the test harness, plus edits to AD-4, AD-6/AD-9, AD-11/AD-14, AD-16, AD-17 and the Stack table.

---

## 1. Layer rows

| Layer (test strategy) | Spine coverage | Status | Problem | Fix |
|---|---|---|---|---|
| Unit | Vitest, `*.test.ts(x)` beside code | OK with one gap | Unit and component tests share one naming pattern in `apps/web`, so the "per layer" coverage (R18) can't split them. | Name component tests `*.component.test.tsx` (or put them under `components/**`). Define Vitest projects `api-unit`, `api-integration`, `api-contract`, `web-unit`, `web-component`. Coverage is reported per project. |
| Integration | "API integration tests go in `apps/api/test/integration/`" | **Ambiguous** | Test strategy: "API and storage in the test profile". Spine: `test` runs the built images. Builder A starts Fastify in-process (`app.inject`) against a temp SQLite file. Builder B sends HTTP to the compose `api` container. B gets no coverage (R18), can't inspect storage for I2/I4 ("stores nothing", "unchanged") except through GET, and can't reach the unhealthy branch in I7. A can't do I6 (container restart). | New AD (call it AD-20, test harness): integration tests run **in-process** through an exported `buildApp({ config, db })` factory, with `APP_ENV=test`, real better-sqlite3 and the committed migrations, on a fresh temp DB file per test file. That is the "real storage". A separate **stack** suite (`apps/api/test/stack/` or `e2e/stack/`) runs the scenarios that need containers (I6, I7 container health) against the `test` profile. |
| Contract | `apps/api/test/contract/`, Ajv in the Stack | **Ambiguous** | "Running API in the test profile". Which origin? The profile table publishes only `web` in `test`. AD-4 only says `api` publishes no port in `prod`. Builder A publishes an `api` port in `test`, which contradicts the table and lets the test bypass nginx. Builder B goes through `web`. Builder C uses `inject`. The spine also never says that Ajv contract tests are the "equivalent" of Postman MCP that C9 allows. OpenAPI 3.1 needs Ajv's 2020-12 build (`ajv/dist/2020`), and a builder using the default draft-07 `Ajv` will hit `$schema` and keyword errors. | AD-20: contract tests send HTTP to `${API_BASE_URL}`, which defaults to the `test` profile's `web` origin (`http://localhost:${WEB_PORT}/api`), so the deployed proxy path is tested too. They validate every response, and every request in positive cases, against `packages/contract/openapi.json` with `Ajv2020` + `ajv-formats`. **This suite is the C9 "equivalent"**. Postman MCP may import `openapi.json` for exploratory checks but is not part of `pnpm test:all`. Amend AD-4: "`api` publishes no host port in **any** profile. Tests reach it through `web`." |
| Component | RTL + MSW in Stack; no rule | **Ambiguous** | "UI only, API stubbed". Under AD-11, builder A mocks the `todos` hooks module, and builder B renders real hooks with a real `QueryClient` and stubs the network with MSW. The two give different K4/K5 behaviour (optimistic delete, loading and error states). With jsdom + Node `fetch`, a relative `/api/todos` (AD-4) throws `Invalid URL` before MSW sees it unless the client resolves against `location.origin`. The test environment (jsdom, happy-dom or Vitest browser mode) is unstated. That decides whether "Chrome DevTools MCP to debug" (C10/T4) can apply to component tests at all. `@testing-library/user-event` (needed for K6 keyboard checks) is not in the Stack. | AD-20: component tests use Vitest + jsdom + RTL + `user-event`, with the **real** hooks and a fresh `QueryClient` per test, and stub only at the network with MSW. MSW handlers are typed from `packages/contract` (`openapi-msw` or the generated `paths` types) so stubs can't drift. The API client builds `baseUrl` as `new URL('/api', location.origin)`, and the jsdom URL is `http://localhost/`. Chrome DevTools MCP applies to the running `dev` profile, not to the Vitest run. Add `@testing-library/user-event` to the Stack. |
| End-to-end | `@playwright/test` in Stack, `e2e/`, `web` on localhost | **Ambiguous** | C10/T5 say "Playwright MCP automates the browser tests". Playwright MCP is an agent tool, not a CI runner, and the spine doesn't say how the two relate. A builder could deliver journeys as MCP sessions that `pnpm test:all` can't run. The base URL and port aren't named. State isolation is undefined (see E5). | AD-20: committed e2e tests are `@playwright/test` specs, run headless by `pnpm test:all` against `E2E_BASE_URL` (the `test` profile's `web`). Playwright MCP is the agent-side tool for exploring and drafting those specs and is not a CI dependency. Fix `WEB_PORT` in `.env.example`. |
| Accessibility | axe-core inside every e2e test (Conventions) | Partly | Axe rule tags aren't fixed (2.2 AA needs `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`). Lighthouse is not in the Stack or placed anywhere. | Conventions: run axe with those tags through one shared fixture `e2e/fixtures/a11y.ts` (`expectNoAxeViolations(page)`). Lighthouse: see Reports. |

## 2. Scenarios

Legend: **OK**: buildable as written, one obvious way. **Amb**: buildable, but two builders would diverge. **Imp**: can't be built under the rules as written. **Conflict**: two spine rules contradict each other.

### Unit

| Id | Status | Notes and fix |
|---|---|---|
| U1 | Amb | Server rule is clear (AD-8). The client pre-check is "may", so a web-side U1 may or may not exist, and K1/K3/E6's "validation message" may come from the client or from a server `400`. **Fix:** see F7. Make the client pre-check mandatory, with a shared pure `validateDescription()` in `apps/web/src/todos/` using `maxLength` from the contract. U1 runs against both the service and that function. |
| U2 | Amb | AD-6 orders by `createdAt desc, id`. AD-10 puts "ordering" in the service, but only the repository may touch SQL, so the order is either an `ORDER BY` in the repository or an in-memory sort in the service. The client must also place an optimistic todo, which has no server `createdAt`. U2 could test any of three places. **Fix:** in AD-10, the repository issues `ORDER BY created_at DESC, id DESC` (I3 proves it). The optimistic helper (AD-13) **prepends** new todos and never re-sorts. U2 tests that placement plus a pure `compareTodos` if one exists. Fix the `id` tiebreak direction (`desc`) explicitly. Also state that the optimistic `Todo` carries a provisional `createdAt = new Date().toISOString()`, replaced on invalidate. |
| U3 | OK | Service-level state change. (On the client this is a `PATCH`, so it is also covered by U4.) |
| U4 | OK | Tests the AD-13 helper with a real `QueryClient` and a stubbed `mutationFn`. AD-20 should say that "unit" in `apps/web` may use a `QueryClient` but no DOM. |

### Integration and contract

| Id | Status | Notes and fix |
|---|---|---|
| I1 | Amb (harness) | Buildable once AD-20 fixes in-process vs container. The "stores it" check needs repository access, which only the in-process harness has. |
| I2 | Amb (harness) | Same. "Stores nothing" needs a repository read or a count. |
| I3 | OK after U2 fix | Also covers the empty list. |
| I4 | Amb (harness) | Same as I2. |
| I5 | OK | `404` is problem+json (AD-9). |
| I6 | **Amb / not placeable** | Needs a real container restart (`docker compose restart api`). The in-process harness can't do it, the spine names no suite that controls containers, and the compose project name for `test` isn't fixed. That matters on a dev machine where the `dev` stack also runs (see F5). If it goes through `web`, nginx may have cached the old `api` IP (F3). **Fix:** AD-20 adds a **stack** suite run by `pnpm test:all` after `up --wait`. I6 creates a todo through `${API_BASE_URL}`, runs `docker compose -p todo-test --profile test restart api`, waits for `api` healthy, then GETs it back. AD-17 adds the nginx resolver fix (F3). |
| I7 | **Imp (unhealthy branch) + Conflict** | (a) With embedded SQLite held open by better-sqlite3, `select 1` keeps succeeding even if the file is deleted (the open fd survives) or its permissions change. AD-2 forbids any other container opening the file. So there is no black-box way to make storage "unreachable". (b) AD-17 puts `select 1` in the health route, but AD-10 says only the repository touches SQL. (c) AD-6 says `503 {status:"unavailable"}`, while AD-9 says every non-2xx from `api` is problem+json, whose `status` is the **number** 503, so the same key has two types. I9 then validates against whichever the builder picked. **Fix:** in AD-17, the repository exposes `ping(): void`, and the health route calls it through the service. In-process integration tests reach the unhealthy branch by closing the db handle passed to `buildApp({ db })`, after which `ping` throws and the route returns `503`. "Storage unreachable" is defined as "the repository's ping throws". In AD-6/AD-9, pick one: health `503` is problem+json (`{type:"/problems/storage-unavailable", title, status:503, detail}`) and `200` stays `{status:"ok"}`, documented in the contract. The stack suite only asserts the healthy path and that the container reports `healthy`. |
| I8 | OK | Integration proves inert storage and return. AD-19 covers rendering. An optional e2e assertion (payload renders as text, no dialog) is cheap. Recommend adding it to E1 at story level. |
| I9 | Amb | See the Contract row. It also needs a rule for negative requests: they deliberately violate the request schema, so "requests validate" applies only to positive cases, and for negative cases the **error response** must validate. Non-`api` errors (nginx `502/504/413`) are outside the contract and must be stated as such, or nginx must emit problem+json for `/api/` errors (F3). |

### Component

| Id | Status | Notes and fix |
|---|---|---|
| K1 | Amb | Who renders the validation message, and where? AD-14 says the announcer owns "save-failure and status messages" and "no component renders a separate alert". A builder could read that as covering field validation and route K1's message to the live region, while another renders it inline. **Fix (F7):** a validation message is inline field help (`aria-invalid` + `aria-describedby`), not an announcer message. A server `400` maps `errors[].message` to that same inline slot. The announcer is for save outcomes and list-level status only. |
| K2 | Amb | "Shows its completion state distinctly" is deferred to UX, but K2 and E2 need a state they can assert. **Fix:** a rule (spine or UX handoff) that completion is exposed in the accessibility tree (native checkbox `checked`, or `aria-pressed`), and tests assert that, not styling. |
| K3 | Amb | Same validation-message question as K1. |
| K4 | Amb | Only passes as "removes it from the list" if real hooks and the optimistic cache run (AD-13). Under hooks mocking (builder A in the Component row), K4 tests nothing real. Fixed by the AD-20 component rule. |
| K5 | **Amb / Conflict with E6** | Under AD-13 every mutation invalidates `['todos']` when it settles. If the API is failing, that refetch fails, and TanStack Query sets `status: 'error'` **while keeping `data`**. A component that renders the R9 error state on `isError` replaces the list, which breaks E6's "list stays usable". **Fix:** in AD-11/AD-14, the list renders the **error state only when there is no data** (`isError && data === undefined`). A failed background refetch with data present publishes to the announcer and keeps the list. Loading state is `isPending`. K5 tests all three conditions plus "refetch error with data keeps the list". |
| K6 | OK after Stack fix | Needs `user-event` (Component row). |

### End-to-end

| Id | Status | Notes and fix |
|---|---|---|
| E1–E4 | Amb (isolation) | Buildable, but the reload assertions depend on shared DB state (see E5). |
| E5 | **Amb, flaky by default** | Needs an empty DB. The `test` volume resets only per run, AD-6 has no bulk/reset endpoint, and Playwright runs files in parallel by default, so E5 races E1–E4. Builder A adds a test-only `DELETE /api/todos` or `/api/test/reset`, which violates AD-6 (no bulk endpoint) and pushes against AD-16. Builder B deletes the volume between tests. **Fix:** in AD-20, e2e runs with `workers: 1`. A shared fixture empties state in `beforeEach` with `GET /api/todos` + `DELETE` each id through `E2E_BASE_URL`, using only public endpoints. No test-only routes, ever. |
| E6 | **Imp as written** | "With the API failing or unreachable": the spine gives no way to do this. The obvious way, `docker compose stop api`, causes three problems. (1) nginx returns an HTML `502`, which is neither problem+json (AD-9 covers only `api`) nor a network failure (AD-14's generic fallback), so client parsing is undefined. (2) When `api` restarts it may get a new IP, and nginx's statically resolved `proxy_pass http://api:…` keeps the stale one, so every later test fails. The same bug hits prod whenever `up -d` recreates only `api`. (3) It disturbs other serial tests. The "invalid description refused" half never reaches the server if the client pre-checks (F7). **Fix:** in AD-20, E6 is the **only** e2e scenario allowed to intercept: `page.route('**/api/todos**', …)` fulfils `500` with a problem+json body (failing), or `route.abort('connectionrefused')` (unreachable), per action. In AD-14, any non-2xx response without `application/problem+json` is treated like a network failure (generic message). In AD-17/AD-4, nginx proxies through a variable with Docker's resolver (`resolver 127.0.0.11 valid=10s; set $api http://api:3000; proxy_pass $api;`) and serves an `error_page` for `/api/` `502/503/504` that returns problem+json. The invalid-description half asserts the inline message from the client pre-check (F7). |
| E7 | Amb | Widths deferred to UX, but Playwright projects need numbers on day one (tracer). **Fix:** two Playwright projects, `phone` (390×844) and `desktop` (1280×800), until UX overrides. E7 = E1–E4 run under both. |
| E8 | OK after axe tag fix | "Keyboard alone" means specs drive only `page.keyboard`. That is a story-level rule. Put axe tags in the shared fixture (Layer table). |

## 3. Reports

| Report | Status | Problem | Fix |
|---|---|---|---|
| Coverage (R18, Q1) | **Ambiguous / partly impossible** | "Line and branch coverage per layer". The e2e and container-based contract/stack runs execute minified bundles and compiled code inside images, so v8 coverage can't be collected from them without instrumenting the prod images, which AD-1 forbids. The One-command row says only "then writes coverage". | AD-20: v8 line and branch coverage is reported for `api-unit`, `api-integration`, `web-unit` and `web-component` (Vitest projects, merged and per-project). Contract, stack and e2e report **scenario coverage**: a table of scenario ids found in test titles against the catalogue, generated by a script that greps titles. The report lists both and records "no code coverage for e2e/contract (images are not instrumented, AD-1)" as an accepted gap. Raw `lcov`/HTML go to `coverage/` (gitignored). Only the dated markdown goes to `docs/quality/`. |
| Performance (R19, Q2) | **Underspecified** | The capability map marks R19 as "C4 targets; Deferred", but R19 measurement is in scope. Only tuning is deferred. The target environment isn't named: profiling the `dev` profile (Vite, unminified, HMR) gives meaningless numbers, and `prod` adds the Cloudflare round-trip. "p95 with one user" has no method. | Add to the map and AD-20: profile the **`test` profile** (built images) on localhost with Chrome DevTools MCP. Record first-load trace, and an interaction trace per action (add, edit, complete, delete) for the 100 ms check. API p95 comes from ≥100 sequential requests per endpoint, read from pino's `responseTime` in `docker compose logs api` or from a small `scripts/perf-api.ts`. Record machine and Chrome version in the report. |
| Accessibility (R14, Q3) | **Lighthouse not placed** | Not in the Stack, not in any rule. Which tool runs it (CLI, or the Chrome DevTools MCP audit) and against which environment and page states is open. | Stack: add `lighthouse` (CLI), or state "run through Chrome DevTools MCP". Rule: at epic close, against the `test` profile's `web`, audit at least the empty state and a populated list (seed through the API). Attach the JSON to the report. The manual keyboard and screen-reader pass needs no architecture. |
| Security (R20, Q4) | Mostly landed (AD-19, AD-4 no CORS) | "Dependency vulnerabilities" has no tool. | Add `pnpm audit --prod` (report-only, not gating) as a CI step or a step in the security review. Optionally scan images with `docker scout` or `trivy`, and say which. |

## 4. Notes T1–T5, D1–D4, Q1–Q4

| Note | Landed? | Where / gap |
|---|---|---|
| T1 scenarios | Yes | Test strategy catalogue. The Conventions row puts ids in test titles. |
| T2 infra at start | Yes (by reference) | C8 tracer. The spine names everything the tracer must stand up only after the AD-20 fix. |
| T3 integration as built + Postman MCP | **Partly** | Integration location yes. The Postman MCP equivalence is not stated (Contract row). |
| T4 component tests + Chrome DevTools MCP debug | **Partly** | No environment or stubbing rule. Chrome DevTools MCP is not placed (Component row). |
| T5 Playwright MCP journeys | **Partly** | `@playwright/test` is in the Stack, but its relation to Playwright MCP isn't stated (E2E row). |
| D1 Dockerfiles multi-stage, non-root, healthchecks | Yes | AD-17, AD-19, source tree. (Not test-related: the `api` base image isn't named, and better-sqlite3's native build differs between alpine/musl and slim/glibc. Worth one line.) |
| D2 compose, networking, volumes, env | **Yes, but not writable as specified** | See F5. |
| D3 health endpoints + logs | Yes, with I7 conflicts | AD-17. See I7. |
| D4 dev/test via env + profiles | **Partly** | AD-16. Per-profile volume and service layout can't be expressed as the table says (F5). |
| Q1 coverage with gaps | Partly | See the Coverage report row. |
| Q2 perf with Chrome DevTools MCP | Partly | Environment and method missing. R19 is mislabelled "Deferred". |
| Q3 Lighthouse or axe, WCAG AA | Partly | axe placed. Lighthouse not placed. Axe tags unfixed. |
| Q4 security review | Yes, mostly | AD-19. Dependency audit tool missing. |

---

## 5. Findings with proposed spine text

### F1 — No rule for where each test suite runs (blocks I1–I9, coverage, CI parity) — HIGH

**Problem:** One Conventions row gives folders, not runtime. In-process versus against-the-stack determines coverage, storage inspection, I6, I7 and the origin used.

**Fix: new AD-20, "Test harness: what runs where"**:

> - `apps/api` exports `buildApp({ config, db })`. **Unit** (service, pure web logic, the AD-13 helper with a real `QueryClient`) and **integration** tests run in-process under Vitest with `APP_ENV=test`. Integration tests use real better-sqlite3, the committed migrations, and a fresh temp DB file per test file, and may read through the repository to assert storage.
> - **Component** tests: Vitest + jsdom + RTL + user-event, real hooks, a fresh `QueryClient` per test, network stubbed only by MSW with handlers typed from `packages/contract`.
> - **Contract**, **stack** (I6, container health) and **e2e** tests run against the `test` profile, started by `pnpm test:all` with `docker compose -p todo-test --profile test up -d --wait --build` after `down -v`. They reach the API only through `web`: `E2E_BASE_URL=http://localhost:${WEB_PORT}`, `API_BASE_URL=${E2E_BASE_URL}/api`.
> - Contract tests validate against `packages/contract/openapi.json` with `Ajv2020` + `ajv-formats`. This is C9's "equivalent". Postman MCP is optional and exploratory.
> - E2E tests are `@playwright/test` specs, `workers: 1`, projects `phone` (390×844) and `desktop` (1280×800), state emptied in `beforeEach` through public endpoints only. Playwright MCP and Chrome DevTools MCP are agent-side tools used against the `dev` or `test` profile, never CI dependencies.
> - No test-only routes, flags or code paths exist in `apps/*`.

Also amend AD-4: "`api` publishes no host port in any profile."

### F2 — Health check: impossible unhealthy test, plus two internal contradictions (I7, I9) — HIGH

**Problem:** See the I7 row. `select 1` on an open embedded DB can't be made to fail from outside. AD-17 conflicts with AD-10 (SQL outside the repository). AD-6's `503 {status:"unavailable"}` conflicts with AD-9's problem+json (`status` as a number).

**Fix:**
- AD-17: "`GET /api/health` calls the repository's `ping()` (a `select 1`). It returns `200 {status:"ok"}` if that succeeds, else `503` problem+json `type: /problems/storage-unavailable`."
- AD-6: change the health error cell to "`503` (problem+json, AD-9)".
- AD-20: "I7's unhealthy branch is proven in-process by closing the db handle passed to `buildApp`. The stack suite asserts the healthy path and that `docker compose ps` reports `api` and `web` healthy."

### F3 — E6 has no defined failure injection, and the obvious one breaks the stack (E6, I6, prod) — HIGH

**Problem:** See the E6 row. Stopping `api` makes nginx return HTML 502s, and when `api` comes back nginx is pointing at a stale IP. The latter also bites I6 and any prod `up -d` that recreates only `api`.

**Fix:**
- AD-20: "E6 injects failure in the browser with `page.route`: `500` problem+json for 'failing', `route.abort('connectionrefused')` for 'unreachable'. No e2e test stops a container."
- AD-4 / AD-17 (nginx): "nginx resolves `api` at request time (`resolver 127.0.0.11 valid=10s; set $api_upstream http://api:<port>; proxy_pass $api_upstream;`), and `error_page 502 503 504` under `/api/` returns `application/problem+json`."
- AD-14: "Any non-2xx without a problem+json body, and any network error, produces the generic failure message."

### F4 — List error state vs optimistic invalidate (K5, E6 "list stays usable") — HIGH

**Problem:** AD-13 refetches `['todos']` on every settle. When the API is failing, that refetch errors, and a list keyed on `isError` swaps to the R9 error state, hiding the list.

**Fix:** AD-11: "The list shows its error state only when the list query has no data (`isError && data === undefined`) and its loading state only when `isPending`. A failed refetch while data exists keeps the list and publishes to the announcer (AD-14)." K5 adds the "refetch fails with data" case.

### F5 — `compose.yml` can't be written as the profile table says (test profile, I6, D2/D4) — HIGH

**Problem:** The table gives `api` in `dev` (watch mode, source mounted), `test` (built image) and `prod` (GHCR image), each with its own volume. A compose service has exactly one definition, so the same name can't have three configs and three volumes. The `test` project name is unstated, so local test runs can collide with a running `dev` stack (same project, same `api` container), and `docker compose restart api` in I6 is ambiguous.

**Fix** (AD-16 plus the profile table):
- Services `web-dev` and `api-dev` are in profile `dev`.
- Services `web` and `api` are in profiles `test` and `prod`, with `image: ghcr.io/abuabdillahi/bmad-todo-api:${IMAGE_TAG:-local}` plus `build:`, so `test` builds locally and `prod` pulls.
- The data volume is `${DATA_VOLUME}` (`todo-dev-data` / `todo-test-data` / `todo-data`). `APP_ENV` and port come from a per-environment env file: committed `.env.test` with no secrets, `.env.dev` from `.env.example`, and the host `.env` in prod.
- Project names: `todo` (prod), `todo-test` (test), `todo-dev` (dev).
- `web` publishes `${WEB_PORT}` only when `WEB_PORT` is set (test), and stays unpublished in prod.
- The Vite dev proxy targets `api-dev`.

### F6 — Coverage "per layer" is undefined for contract, stack and e2e, and unit and component can't be separated (R18, Q1) — MEDIUM

**Fix:**
- Vitest projects per layer, with component tests named `*.component.test.tsx`.
- v8 line and branch coverage is reported per in-process project.
- Container-run layers report scenario-id coverage, generated from test titles, and the report records "no code coverage, images not instrumented (AD-1)" as an accepted gap.
- Raw output is gitignored. The dated markdown goes to `docs/quality/`.

### F7 — Who owns the validation message, and is the client pre-check mandatory? (U1, K1, K3, E6) — MEDIUM

**Problem:** AD-8's "may pre-check" and AD-14's "no component renders a separate alert" let one builder put field validation in the live region and another put it inline. It also makes E6's "invalid description refused with its message" go through different code paths.

**Fix:**
- AD-8: "The client **must** pre-check with a shared `validateDescription()` that reads `maxLength` from the contract."
- AD-14: "Field validation messages are not announcer messages. They render inline, tied to the field with `aria-invalid` and `aria-describedby`. A server `400`'s `errors[].message` goes to the same inline slot. The announcer carries save outcomes and list-level status only."

### F8 — MCP tools, Lighthouse and the performance method are not placed (C9, C10, T3–T5, Q2, Q3, R19) — MEDIUM

**Fix:**
- Stack: add `ajv-formats`, `@testing-library/user-event`, `lighthouse` (or state "via Chrome DevTools MCP"), and optionally `openapi-msw`.
- Capability map: R19 → "AD-20 (measurement); tuning deferred".
- AD-20 states, in one line each:
  - Postman MCP is exploratory, optional, and imports `openapi.json`.
  - Playwright MCP is for exploring and drafting specs. CI runs `@playwright/test`.
  - Chrome DevTools MCP is used for debugging against `dev`, and for performance traces and optionally Lighthouse against `test`.
  - Performance is measured on the `test` profile. API p95 comes from ≥100 requests per endpoint, read from pino `responseTime`.
  - Lighthouse runs at epic close on the `test` profile, covering the empty and populated states.

### F9 — Smaller items (LOW)

- Axe tags fixed in one fixture: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.
- E2/K2 need an accessibility-tree completion state (checkbox `checked` or `aria-pressed`) as a rule for UX to honour.
- U2: fix the `id` tiebreak direction. The optimistic helper prepends, and the optimistic `createdAt` is provisional.
- I9: negative-request cases validate the error response, not the request. nginx-originated errors are out of the contract unless F3's `error_page` is adopted, in which case they are documented too.
- Dependency audit: add `pnpm audit --prod` (non-gating) to CI or to the security review procedure.
- Name the `api` base image (glibc vs musl affects the better-sqlite3 native build in a multi-stage Dockerfile).
- `pnpm test:all` should state its teardown (`down -v` after the run, or keep the stack for debugging behind a flag), so CI and local runs behave alike.
