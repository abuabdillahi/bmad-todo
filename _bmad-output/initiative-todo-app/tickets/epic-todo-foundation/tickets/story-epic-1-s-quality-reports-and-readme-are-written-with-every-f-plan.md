---
title: "Epic 1's quality reports and README, with every finding settled"
type: chore
ticket: '9'
created: '2026-11-25'
status: built
baseline_revision: 'b410ca9ebc6617f599d493250efd9ce1bc536a22'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-todo-app/test-strategy.md'
  - '{project-root}/_bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md'
warnings: [oversized]
deferred:
  - summary: >-
      GitHub's default branch is story-1-1-tracer, not main, so a plain clone from the README gets the old branch and the README's rollback prerequisite (default branch main) is unmet.
    evidence: |-
      git symbolic-ref refs/remotes/origin/HEAD -> refs/remotes/origin/story-1-1-tracer. README Install clones with no --branch; Deploy says the default branch must be main. Changing it is a GitHub setting this run may not touch.
    location: >-
      README.md (Install, Required GitHub settings)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 1 cannot close: `docs/quality/` and `README.md` do not exist. R18 (coverage gaps), R19 (first-load profile, API p95 under 300 ms from ≥100 requests per endpoint), R14 (Lighthouse finds no accessibility violation) and R20 (security review of API injection, containers, dependencies) each need a dated report naming `epic-todo-foundation`, with every finding fixed or accepted with a reason. A new developer has no written way to run, test, read logs, deploy, roll back or extend the app.

**Approach:** Measure the swept code locally against `todo-test` with small committed, rerunnable scripts (so epic 2's close reuses them), write the four reports from those measurements, fix what is cheap and right to fix (re-running the affected measurement), accept the rest with a reason, and write `README.md`. Prove the README by following only it from a fresh clone.

## Boundaries & Constraints

**Always:**
- Report paths: `docs/quality/2026-11-25-epic-todo-foundation-{coverage,performance,accessibility,security}.md` (Conventions › Reports). Each states its date, the epic, the commit measured, the tools and versions, the exact command to reproduce, the raw numbers, and a findings table whose every row is `fixed` (with the change) or `accepted` (with a reason).
- Every measurement, load, Lighthouse run and security probe runs against the local `todo-test` (`http://127.0.0.1:8081`, started with `docker compose -p todo-test --profile test up -d --build --wait`, torn down with `down -v` after) or `todo-dev`. Against `https://bmad-todo.abuabdillahi.com` send only GET requests (e.g. to read response headers or `/api/health`); never POST, PATCH or DELETE there.
- API timing is one user: sequential requests, each endpoint (`GET /api/health`, `GET /api/todos`, `POST /api/todos`) at least 100 timed requests after a short warm-up; report p50, p95, p99, max. The pass bar is p95 < 300 ms per endpoint. `GET /api/todos` is measured with a realistic list (seed e.g. 50 todos first) and the report states the list size.
- Any app or config fix keeps `pnpm test:all` green and is re-measured.
- Accessibility report covers the automated part only (Lighthouse in light and dark, plus the axe-core results from the e2e suite in both colour schemes); it states that the manual keyboard and screen-reader pass belongs to epic-manage-todos (test-strategy Reports, ticket references).
- Performance report covers first load (and the add action, the only action this epic has) profiled in Chromium; first load has no pass bar (epic decision 2026-11-24), so it is documented with its numbers and any issue fixed or accepted.

**Never:**
- No new runtime dependency in any app; no test-only routes or flags in app code (AD-20). Measurement tools run as dev tooling or via `pnpm dlx` with a pinned version recorded in the report.
- No percentage threshold gating the build; no change to CI deploy behaviour; no GitHub settings changes.
- Do not touch the manual a11y pass, load/stress testing or pen-testing (test-strategy Out).
- Do not edit ticket files or `deferred-work.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| p95 run | `todo-test` up, `BASE_URL` set | per-endpoint n ≥ 100, p50/p95/p99/max printed, exit 0 only if every p95 < 300 ms | non-2xx response or unreachable base URL → exit non-zero naming the endpoint |
| p95 against prod | `BASE_URL` is the public hostname | script refuses to send POST | exits non-zero before any request unless host is `127.0.0.1`/`localhost` |
| clean-clone README | fresh `git clone` of this branch, Node 26.13.1, pnpm 12.23.0, Docker | following only README: install, dev profile healthy, test profile healthy, `pnpm test:all` exit 0 | README names the ports that must be free and how to tear down |

</intent-contract>

## Code Map

- `scripts/test-all.mjs` -- one-command run; writes `coverage/{unit,component,integration}/` (v8: `coverage-summary.json`, lcov, html) and `coverage/scenarios.md` via `scripts/scenario-coverage.mjs`. Source for the coverage report; do not change its behaviour.
- `vitest.config.ts` -- coverage reporters/includes per project; read-only unless a gap fix needs it.
- `compose.yml` -- profiles `dev` (`todo-dev`, `web-dev` on `127.0.0.1:5173`, `api-dev`), `test` (`todo-test`, `api` + `web-test` on `127.0.0.1:${TEST_WEB_PORT:-8081}`), `prod` (`todo`, with `cloudflared`). Header comment already shows the up commands; README reuses them. Healthchecks, json-file rotation.
- `apps/api/src/app.ts` -- routes under prefix `/api`: `routes/health.ts` (`GET /api/health`), `routes/todos.ts` (`GET`/`POST /api/todos`). `POST` body `{ id: uuid, description }` (see `packages/contract/src/todo.ts`); a measurement script mints a fresh `crypto.randomUUID()` per request.
- `apps/api/src/todos/repository.ts` -- Drizzle queries (injection review: confirm no `sql.raw`/string-built SQL).
- `apps/api/src/server.ts`, `apps/api/src/config.ts` -- pino logging, env validation (review: no todo text logged at info).
- `apps/web/src/components/TodoCard.tsx` -- renders todo text (review: React escaping only; grep repo for `dangerouslySetInnerHTML`, `innerHTML`).
- `apps/web/nginx.conf` -- CSP and security headers; `/api/` proxy. Read for the security report; Lighthouse best-practices findings may land here.
- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`, `.env.example` -- multi-stage, non-root (verify with `docker compose -p todo-test exec <svc> id`), no secrets baked in (`docker history`, image file listing).
- `.github/workflows/ci.yml` -- deploy job and `workflow_dispatch` input `sha` for rollback (header comment explains); README's deploy/rollback sections describe this, plus required GitHub secrets/vars (names only) and the one-time host bootstrap from the epic's story 2 hitl note.
- `e2e/playwright.config.ts`, `e2e/axe.ts` -- projects desktop, phone (Pixel 7), desktop-dark; axe tags. Chromium is at `~/Library/Caches/ms-playwright/chromium-1255` (use `playwright`'s `chromium.executablePath()` for Lighthouse's `CHROME_PATH`).
- `e2e/package.json` -- has `@playwright/test`; a first-load profiling script that needs Playwright belongs under `e2e/` (e.g. `e2e/perf/first-load.mjs`, run with `node`), outside Playwright's `testDir` match so the suite does not pick it up.
- `.gitignore` -- `coverage/` ignored; raw Lighthouse JSON/HTML must not be committed unless small; summarize numbers in the report.
- `package.json` -- root scripts; add named scripts for the measurements (e.g. `perf:api`, `perf:first-load`) so README and reports cite one command each.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/perf-api.mjs` (+ root `package.json` script `perf:api`) -- sequential one-user timing per the I/O matrix: warm-up, seed list, ≥100 timed requests per endpoint, p50/p95/p99/max, refuse non-local hosts, exit non-zero on any p95 ≥ 300 ms or failed request -- R19's repeatable API measurement
- [x] `e2e/perf/first-load.mjs` (+ root script `perf:first-load`) -- Chromium via Playwright, cold cache, several runs against `todo-test` with a seeded list: navigation timing (TTFB, DOMContentLoaded, load), FCP/LCP, transferred JS/CSS bytes, time until the list renders; plus the add action's time from submit to the card appearing (C4 100 ms target is epic 2's to measure formally; record it). Print a summary table -- R19's first-load profile
- [x] Lighthouse runs (light and dark; dark via Chrome flags or emulation — confirm dark actually applied, e.g. by Lighthouse's final screenshot or a computed background check) against `todo-test` with `pnpm dlx lighthouse@<pinned>` and `CHROME_PATH` set to Playwright's Chromium; categories accessibility, best-practices, performance -- R14 audit
- [x] Security review on `todo-test` and the code: `pnpm audit --prod` and full `pnpm audit`; grep for `dangerouslySetInnerHTML`/`innerHTML`/`sql.raw`/string-built SQL; injection probes (SQL-like and `<script>`/`<img onerror>` descriptions created on todo-test, confirmed stored verbatim and rendered as text in the browser); container user (`id`), image contents for secrets/.env, compose for secrets, CORS (no `Access-Control-Allow-Origin` on API responses), response headers on test and (GET only) on production; logs at info contain no todo text -- R20
- [x] App/config fixes for findings that are cheap and correct to fix; re-run `pnpm test:all` and the affected measurement after each -- every finding settled
- [x] `docs/quality/2026-11-25-epic-todo-foundation-coverage.md` -- line/branch per project from `coverage-summary.json`, scenario coverage from `coverage/scenarios.md` against the epic's scenario list (U1, U2, U4, U5 create half, I1–I3, I6, I7, I10, K1, K7, E1, create/list of I8, I9, I11, K6, E6, E7, E8), uncovered files/branches listed as gaps, each closed (with the test added) or accepted with a reason
- [x] `docs/quality/2026-11-25-epic-todo-foundation-performance.md`, `…-accessibility.md`, `…-security.md` -- per Boundaries › Always
- [x] `README.md` -- what the app is; prerequisites (Node 26.13.1, `npm i -g pnpm@12.23.0`, Docker + Compose v2, free ports 5173/8081); install; run dev and test profiles (and tear down); test (`pnpm test`, `pnpm test:all`, where coverage lands); read logs (`docker compose -p <project> logs -f <svc>`, health); deploy (push to `main`, what CI does, required secrets/variables by name, one-time host/Cloudflare bootstrap); roll back (`workflow_dispatch` with an earlier `main` SHA); extend (layering AD-10/AD-11, contract-first: edit TypeBox schema → `pnpm gen:openapi`, add route/service/repository, migrations via `db:generate`, tests with scenario ids, the mutation helper and announcer for writes); links to `docs/quality/` and the measurement scripts
- [x] Clean-clone check: `git clone` the branch (after committing) into a temp dir, follow only the README; fix the README wherever a step fails or is missing; record the outcome in Implementation Notes

**Acceptance Criteria:**
- Given `docs/quality/`, when it is listed, then it holds exactly four reports dated 2026-11-25 naming `epic-todo-foundation`, and every finding row in each is `fixed` or `accepted` with a reason.
- Given `todo-test` is up, when `pnpm perf:api` runs, then each of the three endpoints shows n ≥ 100 and p95 < 300 ms, matching the performance report's table.
- Given the Lighthouse runs in light and dark, when the accessibility report is read, then the accessibility category shows no failing audit in either scheme, or each failing audit is fixed and re-run.
- Given a fresh clone of this branch, when a teammate follows only README.md, then `todo-dev` and `todo-test` start with every container healthy and `pnpm test:all` exits 0.

## Implementation Notes

2026-11-25, unattended build on `story-1-9-quality-reports`. One local commit, `b7a2106`. It was needed for the clean-clone step and has not been pushed. This plan file is left uncommitted.

**Files touched**
- New: `scripts/perf-api.mjs`, `e2e/perf/first-load.mjs`, `e2e/perf/lighthouse.mjs`, `README.md`, and `docs/quality/2026-11-25-epic-todo-foundation-{coverage,performance,accessibility,security}.md`.
- `package.json`: root scripts `perf:api`, `perf:first-load` and `perf:lighthouse`. No dependency was added.
- `apps/web/nginx.conf`: `Strict-Transport-Security: max-age=31536000` (security S2). `location /assets/` sends `expires 1y` with `try_files $uri =404`. `location /` sends `expires epoch`, which means `Cache-Control: no-cache` (performance P1).
- `apps/api/test/profile/headers.profile.test.ts`: also asserts HSTS.

**Decisions**
- Lighthouse got its own committed script, `perf:lighthouse`, which the plan did not ask for. Without it, the dark run's flags, the pinned version (`lighthouse@13.6.0`) and `CHROME_PATH` would be a long hand-typed command. The script writes to `coverage/lighthouse/` (git-ignored) and runs mobile and desktop × light and dark.
- The colour scheme is forced with `--blink-settings=preferredColorScheme=0|1`. Before each run, a `--dump-dom` probe in the same Chromium must report the expected `prefers-color-scheme`. Surprise: this Mac is in dark mode, so a first Lighthouse run with no flag ("light") actually audited dark. The probe catches that. The final screenshots were also checked by eye.
- `perf:api` defaults to 200 timed requests per endpoint (minimum 100, `PERF_N`), with 20 warm-ups and the list seeded to 50. The time covers the full response body, through nginx. Before any request it refuses every host but `127.0.0.1`, `localhost` and `[::1]`. That was checked: with the production URL it exits 1, and with an unreachable port it exits 1 and names the endpoint. `perf:first-load` and `perf:lighthouse` apply the same refusal.
- Epic 1 has no DELETE, so the scripts cannot reset the list. The list size used is measured and printed. Report numbers come from a fresh volume, in the order first-load, then api (list of 55), then lighthouse.
- Coverage gaps: all 17 accepted with reasons, no test added. Every scenario in the epic's list passes. The gaps are bootstrap code, epic-2 paths (edit/complete/delete, Try again), browser fallbacks and defensive branches. `problems.ts` lines 71 and 74 were checked: they are `validation ?? []` and the message fallback, not the array-body case, which I2 already covers.
- Security S2: the HSTS header is fixed in nginx. Production also serves the app over plain HTTP with no redirect (seen with a GET to `http://bmad-todo.abuabdillahi.com/`). That redirect is accepted as a hitl follow-up: Cloudflare's "Always Use HTTPS". The README's bootstrap section says so. An origin redirect on `X-Forwarded-Proto` was not added, because it could not be verified end to end without touching production.
- Gzip at the origin was not added (P3, accepted). Cloudflare serves brotli: 84.5 KB of JS in production, measured with a GET.

**Verification**
- `pnpm typecheck` exited 0. `pnpm test:all` exited 0 twice: on the baseline before any change, and after the nginx fix. Both times every layer passed, with unit 178, component 44, integration 47, contract 6, e2e 39, profile 4 and contract-unavailable 3 tests.
- `pnpm perf:api` on a fresh `todo-test` exited 0 with p95 values of 0.6, 0.7 and 0.7 ms (n = 200 each).
- `pnpm perf:lighthouse`: accessibility 100 with 0 failing audits in all four runs. Best practices and performance were 100.
- The headers were checked with curl after the fix on `/`, an asset, a missing asset, a SPA route and `/api/health`. The AD-19 headers survive the `expires` locations.
- Production got only GET requests: `/`, two assets, `/api/health`, and `http://` `/`.
- **Clean-clone check:** I ran `git clone --branch story-1-9-quality-reports` of the local repo into `/tmp/clean-clone` at `b7a2106` and followed only the README. The prerequisites matched: Node 26.13.1, pnpm 12.23.0, Compose v5.7.1, and ports 5173 and 8081 free. `pnpm install --frozen-lockfile` succeeded. The dev `up` returned with both containers healthy, and `/api/health` and `/` answered through :5173. The test `up` returned with both containers healthy. `perf:first-load`, `perf:api` and `perf:lighthouse` all ran from the clone with numbers matching the reports. `down -v` on test and `down` on dev worked. `pnpm typecheck` exited 0 and `pnpm test:all` exited 0. No README step failed or was missing, so the README needed no change.

**Left open / risks**
- Merging to `main` deploys the nginx change. It adds HSTS for one year on the public hostname, without `includeSubDomains`. After that, browsers will refuse plain HTTP for that host for a year.
- "Always Use HTTPS" in Cloudflare is a manual follow-up for a person.
- The manual keyboard and screen-reader pass belongs to epic-manage-todos, as the plan says.
- The `todo-dev_data` volume from the clean-clone dev run is left in place, because `down` without `-v` keeps it, as the README says.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 12 findings — high 0, medium 1, low 11, false 0, maybe-false 0
- findings:
  - `low` `patch` Accessibility A1 has status `n/a`, outside the allowed `fixed`/`accepted` (AC1). — A1 moved out of the findings table into prose.
  - `low` `patch` Security Reproduce `git grep` regex and ``sql`select 1` `` contain backticks inside single-backtick spans, so the rendered command breaks. — Double-backtick spans / fenced block.
  - `medium` `patch` `e2e/perf/first-load.mjs` add timing: listener-registering `page.evaluate` is not awaited before `keyboard.press`, so `pressed` can be null or the promise can hang with no timeout. — Listeners registered in an awaited evaluate; result waited for under a timeout.
  - `low` `reject` `lighthouse.mjs` confirms the scheme with a separate `--dump-dom` probe, not on the Lighthouse run itself. — Same binary and same `--blink-settings` flag passed through `--chrome-flags`; chrome-launcher does not override Blink settings, and the final screenshots were checked by eye (accessibility report). Checking the screenshot in code adds image analysis for an unlikely failure.
  - `low` `patch` `lighthouse.mjs` skips accessibility audits with `scoreDisplayMode: 'error'`, so an audit that did not run passes. — Errored a11y audits now count as failures.
  - `low` `defer` README assumes GitHub's default branch is `main`; `origin/HEAD` is `story-1-1-tracer`, so a plain clone gets the old branch and rollback's stated prerequisite is unmet. — Pre-existing GitHub setting; the run may not touch GitHub settings. Deferred for a person.
  - `low` `patch` README Measurements assume Playwright's Chromium is installed; only `pnpm test:all` installs it. — Added the `playwright install chromium` step.
  - `low` `patch` README port advice says set `E2E_BASE_URL` (test-all derives it) and never mentions the perf scripts' `BASE_URL`; `.env.example` "every variable" claim is inaccurate. — Reworded both.
  - `low` `patch` README says every perf script refuses non-local hosts "because it creates todos"; `perf:lighthouse` creates none. — Reason reworded.
  - `low` `patch` Accessibility "States scanned" omits the `new session` scan (`e2e/todos.spec.ts:96`). — Added.
  - `low` `patch` Security report misquotes `.dockerignore` (`_bmad*`; actual `_bmad`, `_bmad-output`, `.agents`). — Quoted accurately.
  - `low` `patch` `scripts/perf-api.mjs` `PERF_P95_MS` lets the C4 bar be loosened, so exit 0 no longer implies p95 < 300 ms. — Env override removed; bar fixed at 300.

## Design Notes

- Measurement scripts are committed so the epic-2 close reruns them; keep them dependency-free (Node `fetch`, `performance.now()`), except the first-load one, which uses the e2e package's Playwright.
- Chrome DevTools MCP is named by the test strategy as agent-side; Playwright + CDP (`Performance.getMetrics`, `PerformanceObserver` for LCP) in Chromium gives the same numbers reproducibly. Say so in the performance report.
- A coverage gap is a scenario in the epic's list with no test, or source with uncovered lines/branches that matter. Closing one means adding a test with a scenario id; trivial or unreachable lines (e.g. server bootstrap that integration runs through a harness) can be accepted with a reason.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0
- `pnpm test:all` -- expected: exit 0, every layer passed
- `docker compose -p todo-test --profile test up -d --build --wait && pnpm perf:api; docker compose -p todo-test --profile test down -v` -- expected: perf exit 0, every p95 < 300 ms
- `ls docs/quality` -- expected: the four `2026-11-25-epic-todo-foundation-*.md` files

**Manual checks (if no CLI):**
- Clean-clone README walk-through recorded in Implementation Notes, with dev and test profiles healthy and `pnpm test:all` exit 0.

## Auto Run Result

**Summary:** Epic 1's four quality reports are written under `docs/quality/`, dated 2026-11-25 and naming `epic-todo-foundation`, with every finding fixed or accepted with a reason. `README.md` covers run, test, logs, deploy, rollback and extend. Three committed measurement scripts (`pnpm perf:api`, `perf:first-load`, `perf:lighthouse`) refuse any non-local host, so epic 2's close can rerun them. Results on `todo-test`: every API p95 is under 1 ms (n = 200 per endpoint, bar 300 ms). The median first paint is 64 ms and the add shows in about 6 ms. Lighthouse accessibility scored 100 with no failing audit in light and dark, mobile and desktop. Coverage: every scenario in the epic's list passes, and 17 coverage gaps are accepted. Security: no XSS or injection path, both containers run as non-root, and `pnpm audit --prod` is clean. Two fixes landed in `apps/web/nginx.conf`: HSTS (S2), and asset caching with `index.html` revalidated on every load (P1).

**Files changed:**
- `README.md`: new developer guide.
- `docs/quality/2026-11-25-epic-todo-foundation-{coverage,performance,accessibility,security}.md`: the four reports.
- `scripts/perf-api.mjs`: one-user API p95 timing. The bar is fixed at 300 ms.
- `e2e/perf/first-load.mjs`: first-load and add-action profile (Playwright + CDP).
- `e2e/perf/lighthouse.mjs`: Lighthouse 13.6.0 in light and dark, with a forced scheme confirmed by a probe.
- `package.json`: the `perf:*` scripts.
- `apps/web/nginx.conf`: HSTS, `/assets/` cached for a year with a 404 on a missing file, `index.html` sent `no-cache`.
- `apps/api/test/profile/headers.profile.test.ts`: also asserts HSTS.

**Review findings:** 12 in all (quick lens).
- 10 patches applied: 1 medium (an add-timing race in `first-load.mjs`) and 9 low (report and README accuracy, errored Lighthouse audits now counted, the p95 bar no longer settable from the environment).
- 1 deferred (low): GitHub's default branch is `story-1-1-tracer`, not `main`.
- 1 rejected (low): the Lighthouse colour scheme is confirmed by a probe of the same binary with the same flags, not by checking the run's own screenshot. The screenshots were checked by eye, and checking them in code would add image analysis for an unlikely failure.

**Follow-up review recommended:** false. Only one medium was patched, and none was high.

**Verification:**
- `pnpm typecheck` exit 0.
- `pnpm test:all` exit 0, with every layer passing, both before and after the review patches.
- `pnpm perf:api` exit 0 on a fresh `todo-test`, with p95 of 0.6, 0.7 and 0.8 ms. With `BASE_URL` set to production it exits 1 before sending any request.
- `pnpm perf:first-load` exit 0 after the patch.
- `docs/quality/` holds exactly the four reports.
- Clean-clone README walk-through by the implementer: dev and test profiles healthy, `pnpm test:all` exit 0.
- Production received only GET requests.

**Residual risk:**
- Merging to `main` deploys HSTS (`max-age` one year, this hostname only).
- Plain HTTP is not redirected in production until a person turns on Cloudflare's "Always Use HTTPS".
- GitHub's default branch is not `main` (deferred).
- The manual keyboard and screen-reader pass belongs to epic-manage-todos.
