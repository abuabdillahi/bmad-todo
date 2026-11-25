---
title: 'The README and .env.example match how the app really runs'
type: chore
ticket: '3'
created: '2026-11-25'
status: built
baseline_revision: 'ab75e890531ffed47b2a04d321ba6e5612f67a83'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Four statements a new developer relies on are wrong or missing: `.env.example` says `APP_ENV` "changes log formatting only" though nothing reads it; the README asks only for "Docker with Compose v2" though `compose.yml` needs Compose 2.24.4 (`profiles: !override`) and Engine 25 (`start_interval`); the README says the API logs one JSON line per request, but Fastify writes two; and the README never says that re-running a failed push deploy fails after a day, because the tested images are an artifact kept for one day.

**Approach:** Edit only `README.md` and `.env.example` so each statement matches the code, `compose.yml`, `.github/workflows/ci.yml` and a real API log, keeping `APP_ENV` required (ticket Notes). Ticket Requirements 1–5 are the acceptance criteria; Boundaries: nothing outside those two files changes.

</intent-contract>

## Implementation Notes

Oneshot: about 20 changed lines of prose in two files, no code.

Facts the edits rest on (checked at the baseline):
- `APP_ENV`: `apps/api/src/config.ts:35-38` rejects anything but `development`, `test`, `production` (unset included), and `server.ts` exits 1 on a `ConfigError`. `appEnv` is read nowhere else in `apps/api/src`; the logger is `{ level: config.logLevel }` only (`app.ts:20`). AD-16 allows only log formatting to depend on it, so v1 meets AD-16 by using it for nothing.
- Compose: `compose.yml:59,69` use `profiles: !override` (Compose 2.24.4 or later); every health check uses `start_interval` (Engine 25 or later). The deploy copies the same file to the host, so the host needs the same minimums.
- Logs: Fastify's default request logging writes "incoming request" (with `req`) and "request completed" (with `res`, `responseTime`), both carrying `reqId` (`genReqId: randomUUID`). Neither includes the body. The profile test (`apps/api/test/profile/logs.profile.test.ts`) proves no todo text only for a successful create and list; failed requests are untested (ticket #35, not here).
- Deploy: `ci.yml:72-79` uploads `images-<sha>` with `retention-days: 1` on `main`; the deploy job downloads it (`:160-165`) and pushes it to GHCR (`:167-177`) only when `github.event_name == 'push'`. A `workflow_dispatch` run skips `test`, the download and the push, and pulls `<sha>` from GHCR (`:196-207`), so a rollback by hand works at any age once that SHA's images are in GHCR. A re-run of a failed push deploy is still a `push` event, so after a day its download step fails. Instead: when the failed run already pushed its images to GHCR, deploy that SHA by hand as in Roll back; otherwise merge a new commit to `main`, whose own run tests, saves and deploys it.

Implementation (2026-11-25):
- `.env.example:9-10`: `APP_ENV` is now "Required: the API refuses to start when it is unset or any other value. No behaviour depends on it in v1." The log-formatting claim is gone.
- `README.md` Prerequisites: Docker Engine 25+ and Compose 2.24.4+, naming `profiles: !override` (`web-test`, `api-dev`) and `start_interval`. One-time bootstrap: the host needs the same minimums, since the deploy runs the same `compose.yml`.
- `README.md` Logs and health: two lines per request with the same `reqId`; the todo-text claim narrowed to what the profile test proves (successful create and list), and says failed requests are not tested yet (ticket #35).
- `README.md` Deploy: step 1 says the images are saved as an artifact kept for one day, step 2 that `deploy` downloads it; a new paragraph says "Re-run failed jobs" fails after a day and what to do instead. Roll back step 3 says a run by hand skips the artifact and pulls from GHCR, so it works long after the test run.
- Surprise: Docker's docs no longer state the Compose version for `!override`. Engine 25 for `start_interval` is confirmed by the Engine 25.0.0 release notes ("Add an additional interval to be used by healthchecks during the container start period"). Compose 2.24.4 is the retrospective's figure (R6); its release notes bump compose-go to v2.0.0-rc3 "to fix multiple compose files merge issues", consistent with it, and the local Compose v5.7.1 / Engine 29.9.3 run the file.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 10 findings — high 0, medium 2, low 7, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` Re-run advice: deploying the failed SHA by hand skips the newer-SHA guard (`ci.yml:144-146` runs only on `push`), so after a day it can roll production back — patched: a first bullet says to check what is live and do nothing when a newer commit has deployed, because a run by hand has no newer-SHA check.
  - `[low]` `[patch]` "after that the re-run fails at Download" is not always true: with a newer SHA live the guard skips the download (`ci.yml:161`) — patched: "unless a newer SHA is already live, in which case it skips".
  - `[low]` `[patch]` The bullet sends a never-deployed SHA to Roll back, whose step 2 asks for a commit "deployed before" — patched: the bullet says its images are in GHCR even though it never deployed, and to use Roll back's steps with `sha` set to the failed commit.
  - `[low]` `[patch]` The bold heading covered every re-run, but only "Re-run failed jobs" is limited; "Re-run all jobs" re-runs `test`, which saves the artifact again — patched: heading narrowed to "Re-run failed jobs" on a failed deploy.
  - `[medium]` `[patch]` "Each request writes two lines" omits the third line the error handler adds for 503 (`problems.ts:96`, `service unavailable`) and 500 (`problems.ts:102`, `unhandled error`), and Fastify's `request errored` (`log-controller.js`) — patched: README names the third line and its levels, and `request errored`.
  - `[false]` `[reject]` "Neither holds the body" says nothing about the error line, where body content could appear — the sentence is about the two request lines, and the README already says failed requests are not tested for todo text (ticket #35 owns that test).
  - `[low]` `[patch]` `incoming request` also carries host, client address and port — patched: "with the method, URL, host and client address".
  - `[low]` `[patch]` The request lines are at `info`, so at `LOG_LEVEL=warn` none appear; the old "at info" qualifier was dropped — patched: "two lines at `info`".
  - `[low]` `[patch]` The todo-text claim no longer says at which level it was proven — patched: "proves, at `LOG_LEVEL=info`, ...".
  - `[low]` `[reject]` Plan Verification expects Docker's reference to state Compose 2.24.4 and records no outcomes — its fix is an edit to this build's plan; outcomes are recorded under Auto Run Result, and the 2.24.4 source is stated in Implementation Notes.

## Verification

**Commands:**
- `git diff --name-only ab75e890531ffed47b2a04d321ba6e5612f67a83` -- expected: only `README.md`, `.env.example` and this plan.
- `grep -rn "appEnv\|APP_ENV" apps/api/src` -- expected: only `config.ts` and its test (criterion 1: nothing depends on it).
- `APP_ENV=bogus PORT=3999 DATABASE_PATH=/tmp/x.db node apps/api/src/server.ts` -- expected: exits 1 naming `APP_ENV` (criterion 1: refuses to start).
- Run the API locally (`APP_ENV=test PORT=3999 DATABASE_PATH=<tmp> LOG_LEVEL=info node apps/api/src/server.ts`), send one `POST /api/todos` with a marker and one `GET /api/todos` -- expected: each request writes exactly two JSON lines, `incoming request` and `request completed`, with the same `reqId`, and no line holds the marker (criterion 3, a real log).
- `grep -n "start_interval\|!override" compose.yml`, plus Docker's compose-file reference for the version each needs -- expected: Compose 2.24.4 for `!override`, Engine 25 for `start_interval` (criterion 2).
- `grep -n "retention-days\|event_name\|download-artifact" .github/workflows/ci.yml` -- expected: matches the README's Deploy and Roll back text (criterion 4).
- `pnpm test` and `pnpm typecheck` -- expected: pass (no code changed).

## Auto Run Result

Status: built.

Summary: `.env.example` and `README.md` now match the code, `compose.yml`, the workflow and a real API log for the four statements in the ticket.

Files changed:
- `.env.example` -- `APP_ENV` is required, refused when unset or invalid, and drives no behaviour in v1; the log-formatting claim is gone.
- `README.md` -- Docker Engine 25 / Compose 2.24.4 minimums (prerequisites and host bootstrap) with what needs them; the request log lines as they are (two at `info`, a third on 503/500), and the todo-text claim narrowed to what the profile test proves; the one-day artifact in Deploy, a "Re-run failed jobs" paragraph with what to do instead, and Roll back saying a run by hand pulls from GHCR and works at any age.

Review (quick): 10 findings. Patched 8 (medium 2, low 6). Deferred 0. Rejected 2: one `false` (the README already says failed requests are untested for todo text), one whose fix is a plan edit.

Follow-up review recommended: true. Two medium entries were patched. Unverified risk: the patched error-path log description (third line on 503/500) rests on reading `problems.ts` and Fastify's `log-controller.js`, not on a real failing request's log, and the re-run guidance rests on reading `ci.yml`, not on a real re-run older than a day.

Verification (outcomes):
- Criterion 1: `grep -rn "appEnv\|APP_ENV" apps/api/src` -- only `config.ts` and `config.test.ts`. `APP_ENV=bogus` and unset `APP_ENV` each make `node apps/api/src/server.ts` exit 1 with "APP_ENV must be one of development, test, production".
- Criterion 2: `compose.yml:59,69` use `profiles: !override`; `:32,51,109,130` use `start_interval`. Engine 25 from the Engine 25.0.0 release notes; Compose 2.24.4 from retrospective R6, consistent with Compose v2.24.4's compose-go v2.0.0-rc3 merge fix. The local Compose v5.7.1 / Engine 29.9.3 run the file.
- Criterion 3: the API run locally at `LOG_LEVEL=info`; one POST and one GET `/api/todos` each wrote exactly `incoming request` then `request completed` with the same UUID `reqId`; the marker in the todo text appeared in 0 log lines.
- Criterion 4: `ci.yml:78` `retention-days: 1`; `:161,168` download and push only on `push`; `:144-146` the newer-SHA guard only on `push`; `:27` `test` only on `push`; `:196-207` the host pulls from GHCR.
- `git diff --name-only` against the baseline: `README.md`, `.env.example` and this plan only. `pnpm typecheck` passed; `pnpm test` 269/269 passed. The local compose stack was not used.

Residual risks: the Compose 2.24.4 figure is not stated in Docker's current docs.
