---
title: "The whole app's security review is written, with every finding settled"
type: chore
ticket: '8'
created: '2026-11-25'
status: built
baseline_revision: '58796f05a4f6b1d637b1d67f8c2b87f2afa8022a'
route: full
route_source: auto
risk: medium
review: thorough
review_source: auto
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/quality/2026-11-25-epic-todo-foundation-security.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic manage-todos added edit, complete, reactivate and delete (PATCH, DELETE, the edit field, new announcements) and changed nginx and compose since epic 1's security review, and none of it has been reviewed. Backlog #26, #27 and #28 wait on this review for a decision, and 2.2's review left two undocumented `400`s on `DELETE` for it to settle.

**Approach:** Review XSS in rendered and edited text, injection on the update and delete routes, and every change since epic 1's review, with probes on `todo-test` only. Write `docs/quality/2026-11-25-epic-manage-todos-security.md` in epic 1's report format. Fix the small findings here: nginx's own 4xx under `/api` become AD-9 problems (#28), and `DELETE` documents its `400`. Record #26 and #27 as fixes proposed to the user, not built.

## Boundaries & Constraints

**Always:**
- Every shell command starts with `cd /Users/idris/me/todo-wt/story-2-8-security-review && export PATH=$HOME/.nvm/versions/node/v26.13.1/bin:$PATH && `. Work only in that worktree and on branch `story-2-8-security-review`. Never read or write `/Users/idris/me/todo` or another worktree. Do not commit, push or open PRs; the caller does that.
- Docker: only compose project `todo-test` (`docker compose -p todo-test --profile test ...`, 127.0.0.1:8081), normally through `pnpm test:all`. Before any run that uses todo-test (`pnpm test:all`, or bringing the stack up for probes), take the lock: `mkdir /tmp/todo-test-stack.lock` (if it fails, someone else holds it: poll every 60 s or so, running only `pnpm test` and `pnpm typecheck` meanwhile), then `echo "#49 story-2-8-security-review" > /tmp/todo-test-stack.lock/owner`. Release it with `rm -rf /tmp/todo-test-stack.lock` as soon as each run ends and todo-test is down (check `docker compose ls`). Never hold it while idle, never remove a lock you do not own, and report how many times you took it.
- Probes and tests aim only at todo-test (`http://127.0.0.1:8081`) or in-process tests. Probe scripts are one-off files under `/tmp`, not committed, and described in the report's Reproduce list.
- The report follows epic 1's report's structure (header with Date, Epic, Commit measured, Environment, Tools, Reproduce; Results; a Findings table with #, Severity, Finding, Status, Change or reason). Every finding is `fixed` or `accepted` with a reason; a fix outside the repo's reach is `accepted` with the follow-up named.
- The report has a "Backlog decisions" section with one line per ticket, each starting `#26 —`, `#27 —`, `#28 —` and containing `Decision: 2026-11-25`, taken from Design Notes. The #26 line cites the ea86627 incident as given there.
- nginx's own problem body is AD-9's validation problem, byte for byte what the API sends: `{"type":"/problems/validation","title":"Invalid request","status":400,"detail":"The request is not valid."}`, with `Content-Type: application/problem+json` (empty `types {}` + `default_type`, as `@api_unavailable` does) and the AD-19 headers (no `add_header` inside any location).

**Never:**
- Edit `.github/workflows/*`, secrets, the host, the Cloudflare tunnel, `compose.yml`'s production settings, the architecture spine, or any file under `_bmad-output/` other than this plan. No GitHub issue edits.
- Any request, test or probe against the production hostname.
- Change the API contract for create and list (GET and POST `/api/todos` keep their documented responses), the API's runtime error handling, or the web client.
- Intercept the API's own responses (`proxy_intercept_errors` stays off), or change nginx's answers outside `/api/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Over-limit body through nginx | `POST /api/todos` via web-test, JSON body of 1 MiB + 1 byte | `400`, `application/problem+json`, the validation literal, AD-19 headers; documented for POST 400 | Was nginx's HTML 413 |
| Malformed percent-encoding through nginx | `GET`, `PATCH`, `DELETE` `/api/todos/%zz` via web-test | `400` validation problem, AD-19 headers; documented for PATCH and DELETE | Was nginx's HTML 400 |
| Malformed id reaching the API | `DELETE /api/todos/%E0%A4%A` in-process | `400` validation problem, documented for DELETE 400, no id echoed | Fastify's bad-URL error through the one handler (unchanged) |
| DELETE with a JSON content type and no body | `DELETE /api/todos/{id}`, `Content-Type: application/json`, empty body | `400` validation problem, documented for DELETE 400, nothing deleted | unchanged runtime behaviour |
| Outside `/api` | `GET /%zz` via web-test | nginx's own `400` HTML page, AD-19 headers | unchanged |
| API's own errors | `PATCH /api/todos/{id}` with `{}` via web-test | the API's problem passes through untouched | existing contract test |

</intent-contract>

## Code Map

- `docs/quality/2026-11-25-epic-todo-foundation-security.md` -- epic 1's report: the format to follow, and findings S1-S5 to carry forward (S3 is #28). Epic 1 measured `e96a258`; everything changed since is in `git diff --stat e96a2588078a4df3e3884daab40dd557fb450aa5..HEAD -- apps packages e2e scripts compose.yml .github pnpm-lock.yaml .dockerignore .env.example`. No dependency, Dockerfile or `.github` change since then; `pnpm audit --prod` is clean and `pnpm audit` shows only S1's esbuild advisory (checked at planning).
- `apps/web/nginx.conf` -- server-level AD-19 headers; `location /api/` with `error_page 502 503 504 = @api_unavailable`; `@api_unavailable` is the pattern for a literal problem body. nginx rejects a malformed percent-encoding while parsing the request, before any location is chosen, so its `400` only reaches a server-level `error_page`; the `413` (default `client_max_body_size` 1m) is raised inside `location /api/`, whose own `error_page` lines replace the server-level ones there. Paths outside `/api/` must keep nginx's default pages: in a named location reached by `error_page`, a bare `return 400;` gives nginx's built-in page (`recursive_error_pages` is off), and `if ($request_uri ...) { return ...; }` is safe.
- `apps/api/src/problems.ts` -- `PROBLEMS.validation` (the literal), `problemErrorHandler`: any Fastify client error, including its own 413 for a body over its 1 MiB `bodyLimit`, becomes the validation problem with status 400. nginx answering 400 for its 413 matches that.
- `apps/api/src/routes/todos.ts` -- the `DELETE` schema's `response` lacks `400: problemResponses[400]`; PATCH and POST have it. `TodoParams`: any string id, `maxParamLength` 100, parameterised.
- `apps/api/src/todos/repository.ts` -- Drizzle only (`eq`, `update().set()`, `delete().where()`), one constant raw `select 1`.
- `packages/contract/openapi.json` -- generated by `pnpm gen:openapi`; CI fails on a diff.
- `apps/api/test/integration/openapi.test.ts` l.67-75 -- pins DELETE's statuses `['204','404','500','503']`.
- `apps/api/test/integration/update-delete.test.ts` -- `remove`, `patch`, `todoUrl`, `expectNotFound`, `storedRows`; `todo-checks.ts` has `expectValidationProblem(response, path, method, field?)` and `expectNothingLeaked`. `todos.test.ts` "malformed URLs" is the GET precedent.
- `apps/api/test/contract/todos.contract.test.ts` -- `send`, `call`, `expectDocumented`, against web-test via `E2E_BASE_URL`. `apps/api/test/security-headers.ts` -- `expectSecurityHeaders`. `apps/api/test/profile/headers.profile.test.ts` -- I12 checks per nginx location.
- Rendered and edited text, for the XSS review: `TodoCard.tsx` (`{todo.description}` text child; `aria-label` templates with the description), `EditForm.tsx`/`TextField.tsx` (controlled textarea; paste and drop insert cleaned plain text with `execCommand('insertText')` or `setRangeText`), `todos/messages.ts` (`quote()` into announcement strings), `Announcer.tsx` (text children), `TodoList.tsx` (Loading status via `textContent`), `api/client.ts` (`encodeURIComponent(id)` in PATCH/DELETE paths; DELETE sends no body and no Content-Type).
- `.github/workflows/ci.yml` -- read-only, for #26/#27: `on: push` to every branch and `workflow_dispatch` with `sha`; `deploy` gated on `github.ref == 'refs/heads/main'`, concurrency `deploy-prod`, `cancel-in-progress: false`; the "Skip if a newer SHA is already deployed" guard reads the running api image tag over SSH. Deploy secrets are repository secrets, not a protected environment.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/nginx.conf` -- add one named location (e.g. `@api_invalid`) that answers the validation literal with status 400 when `$request_uri` starts with `/api/`, and otherwise `return 400;` (nginx's page). Point a server-level `error_page 400` at it, and add `400 413` to `location /api/`'s error pages pointing at it. Comment why (AD-9, #28, the API's own 413 handling). -- #28.
- [x] `apps/api/src/routes/todos.ts`, then `pnpm gen:openapi` -- document `400: problemResponses[400]` on DELETE; regenerate `packages/contract/openapi.json`. Update `openapi.test.ts`'s DELETE expectation to include `400`. -- 2.2's notes.
- [x] `apps/api/test/integration/update-delete.test.ts` -- I9 tests: `DELETE /api/todos/%E0%A4%A` and `PATCH` of the same, and a `DELETE` with `Content-Type: application/json` and an empty body, each a documented validation problem (`expectValidationProblem`), nothing deleted or changed, the raw id not echoed.
- [x] `apps/api/test/contract/todos.contract.test.ts` -- I9 + I12 tests through web-test: the over-limit POST and the `%zz` GET/PATCH/DELETE answer the validation literal as `application/problem+json`, validate against openapi.json for their route and method (GET's 400 is not documented: assert the body and headers only), and carry `expectSecurityHeaders`.
- [x] `apps/api/test/profile/headers.profile.test.ts` -- I12: `GET /%zz` outside `/api` is still nginx's `400` `text/html`, with the AD-19 headers.
- [x] `/tmp/story-2-8-probes/` (one-off, not committed) -- probes on todo-test, under the lock: XSS payloads (`<script>…`, `<img src=x onerror=…>`, `{{constructor…}}`, SQL strings) stored by PATCH and typed into the edit field in Chromium (Playwright from `e2e/`), shown in the card, in the edit field, in an `aria-label`, and in a failure announcement (force a PATCH failure with `page.route`): text only, no `script`/`img` element, `window.__pwned` unset, no dialog. API probes: PATCH/DELETE with injection ids, a `__proto__` body, an id over 100 characters, the matrix rows before and after the nginx change. `id` of the api and web-test containers.
- [x] `docs/quality/2026-11-25-epic-manage-todos-security.md` -- the report (see Always), covering: dependencies (re-audited), code grep (epic 1's command), XSS in rendered and edited text, injection on PATCH/DELETE, everything changed since `e96a258` (nginx `proxy_read_timeout`, compose `name:` guard, `.env.example`, no dependency/Dockerfile/CI change), containers, logs (I13 tests), headers (todo-test only; production not probed, by rule). Findings: carry S1, S2's redirect follow-up, S4, S5 with their status; #28 fixed; DELETE's 400 fixed; GET's malformed-URL 400 accepted (list contract must not change; it is AD-9's problem); the repository-level deploy secrets (info, accepted, environment proposed); anything new the probes find. Note for the architect: AD-4 and AD-6's table do not yet mention nginx's 400 problem or DELETE's 400 (spine not edited in this run).

**Acceptance Criteria:**
- Given `docs/quality/`, when the story closes, then `2026-11-25-epic-manage-todos-security.md` names epic-manage-todos, covers XSS in rendered and edited text and injection on update and delete, lists every finding as fixed or accepted with a reason, and has a `#26 —`, `#27 —` and `#28 —` decision line.
- Given the matrix, when `pnpm test` and `pnpm test:all` run, then every row is checked by a test that runs and passes.
- Given the change, when `pnpm typecheck`, `pnpm test` and `pnpm test:all` run, then each exits 0, and `pnpm gen:openapi && git diff --exit-code packages/contract/openapi.json` exits 0 after the regenerated file is in the tree.

## Implementation Notes

- nginx: a named location (`@api_invalid`) failed for the parse-time 400: nginx logged "empty URI in redirect to named location" and answered its HTML 500 (seen on todo-test). A request whose URI fails to parse has no `r->uri`, and `$request_uri` is still empty then. So the server-level `error_page 400` and `location /api/`'s `error_page 400 413` point at a URI, `location = /api/_nginx/invalid-request`, and its `if` tests `$request` (the request line, set before the URI is parsed) against `^[^ ]+ /api/`. Requested directly, that path answers the validation problem; it is no API route. Outside `/api/` nginx's own page is unchanged (`GET /%zz`: 400 `text/html`, 150 bytes, before and after).
- The API probe found that an id over 100 characters answers 400, not the 404 `TodoParams`' comment claimed (Fastify 5's `FST_ERR_MAX_PARAM_LENGTH`, 414, through the one error handler). Comment fixed, and an I9 integration test pins it for PATCH and DELETE (report S8).
- `VALIDATION_BODY` added to `apps/api/test/openapi-schema.ts` beside `UNAVAILABLE_BODY`. The existing contract test of `PATCH {}` now also asserts the API's `charset=utf-8` media type, showing nginx passes the API's own problem through.
- todo-test lock taken 4 times: probes before the change, probes after it, `pnpm test:all`, then the contract run after review fixes.
- Review fixes: a raw-socket contract test (invalid chunk size) pins `location /api/`'s own `error_page 400`, confirmed by dropping 400 from that line on todo-test (the test failed) and restoring it; a through-web-test `DELETE` with a JSON content type and empty body; the integration tests compare the API's body to `VALIDATION_BODY` byte for byte; nginx's header comment names the reserved path; report corrections (S3/#28 edge and not-covered list, S7 split, `%00` label, S11, code-only XSS paths, branch name).

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 23, false 1, maybe-false 0 (5 intent-alignment observations triaged as findings; none graded high)
- findings:
  - `[low]` `[patch]` (blind-hunter) The nginx-only path `/api/_nginx/invalid-request` is not reported or named in the architect note, and nginx.conf's header comment ("forwards /api/* unchanged") is now wrong. — Patched: the header comment names the one /api path nginx answers itself; the report names it in S3, the #28 line and the architect note (AD-4).
  - `[low]` `[reject]` (blind-hunter) Plan task 1 still describes the `@api_invalid`/`$request_uri` design and the Plan Change Log is empty. — The fix edits this build's plan; Implementation Notes record the deviation.
  - `[low]` `[patch]` (blind-hunter) Nothing checks nginx's literal equals the API's byte for byte; the integration tests compare a local object with `toEqual`. — Patched: the new integration tests assert `.body` `toBe(VALIDATION_BODY)`; the local constant is gone.
  - `[low]` `[reject]` (blind-hunter) The `not.toContain`/`expectNothingLeaked` checks after an exact body match are redundant. — Harmless; they state the no-echo rule each test exists for. Not worth churn.
  - `[low]` `[patch]` (blind-hunter) S3/#28 say "fixed" though only the origin was checked; Cloudflare's edge may answer first. — Patched: S3 and the #28 line say fixed at the origin, with the edge's answer a follow-up check like S2.
  - `[low]` `[patch]` (blind-hunter) The `$request` regex misses absolute-form targets and unparseable request lines; the report listed only 414/431. — Patched (report): the not-covered list in the #28 line and S9 now names them, accepted.
  - `[low]` `[reject]` (blind-hunter) Only the Content-Length form of the over-limit body is tested, not a chunked one. — Both reach the same `location /api/` `error_page 400 413` line, which the 413 test and the new chunked-400 test pin. No client sends a chunked >1 MiB body.
  - `[low]` `[patch]` (blind-hunter) S7 calls `/api/todos/%zz` the list operation. — Patched: S7 now separates the list URL with a bad escape, the one-todo GET (not a route), and a GET with an over-limit body.
  - `[low]` `[patch]` (blind-hunter) The `%00` probe row sent `%2500`, three characters, not a NUL. — Patched: the row is relabelled.
  - `[low]` `[patch]` (blind-hunter) Client-chosen ids reach the api logs through the request URL, stated without a finding. — Patched: new S11 (info, accepted: ids are not todo text; I13 holds).
  - `[low]` `[patch]` (blind-hunter) The XSS probe did not drive the Delete confirm, Completion/Delete aria-labels or complete/delete announcements. — Patched (report): those are stated as reviewed in code only (same React text/attribute paths).
  - `[low]` `[patch]` (blind-hunter) "Commit measured" names no real commit for the story's changes. — Patched: the report names the branch `story-2-8-security-review`.
  - `[low]` `[reject]` (edge-case-hunter) An over-limit body to `//api/` or `/%61pi/` matches `location /api/` but fails the `$request` regex, so it gets HTML. — Real but no client or the tunnel spells paths so; the fix adds a second location. Listed as not covered in the report.
  - `[low]` `[patch]` (edge-case-hunter) Request lines nginx cannot parse leave `$request` empty, so they keep HTML under /api. — Same root cause as the regex row above; documented in S9 and the #28 line.
  - `[low]` `[patch]` (edge-case-hunter) Absolute-form request lines fail the regex. — Same root cause; documented.
  - `[low]` `[patch]` (edge-case-hunter) Other nginx-own codes under /api (405, 411, 494, 501) stay HTML; report named only 414/431. — Same root cause; documented.
  - `[low]` `[patch]` (edge-case-hunter) GET /api/todos with an over-limit body now gets an undocumented 400. — Same root cause as the S7 row; S7 now lists it, accepted.
  - `[low]` `[patch]` (edge-case-hunter, claim) A reader may believe #28 fully closed. — Same root cause; the #28 line's not-covered list is extended.
  - `[medium]` `[patch]` (verification-gap) `location /api/`'s own `error_page 400` has no test: the %zz tests reach only the server-level line. — Patched: a raw-socket contract test sends a malformed chunked body under /api and asserts the validation literal, media type and headers; with 400 dropped from the location line it fails (mutation check on todo-test).
  - `[low]` `[patch]` (verification-gap, other) Absolute-form and `//api/` request lines fall outside the regex. — Same root cause as the regex rows; documented.
  - `[low]` `[reject]` (intent-alignment) The backlog tickets carry no decision line. — The orchestrator records ticket lines as board bookkeeping (AGENTS.md, `[skip ci]` on main); this build was told not to edit them. The report has all three lines.
  - `[low]` `[reject]` (intent-alignment) The XSS conclusion rests on code review and a one-off probe, not a test `pnpm test:all` re-runs. — Same approach epic 1 used and accepted; a committed browser XSS spec is more than a direct correction. The API-level I8 tests do re-run.
  - `[low]` `[patch]` (intent-alignment) 2.2's DELETE-with-empty-JSON 400 was tested only in-process. — Patched: a contract test sends it through web-test and validates it against DELETE 400. The malformed escape through nginx is covered by the %zz contract tests.
  - `[low]` `[patch]` (intent-alignment) The reserved path and the `$request` regex add surface the findings table did not list. — Same root cause as the blind-hunter reserved-path row; documented.
  - `[false]` `[reject]` (intent-alignment) A cautious reading of "small" would keep #28 out. — The ticket allows fixing when the fix touches no deploy step, secret, host or tunnel, and the caller allowed nginx config in apps/web. An nginx config change in the repo is none of those.

## Design Notes

**Decision lines** (copy into the report; adjust only facts the probes contradict):
- `#26 — Decision: 2026-11-25, proposed to the user (not built: it changes the deploy job).` Proposed fix: a `schedule` trigger (e.g. every 30 min) whose first job reads the SHA production runs, as the deploy guard does, and runs `test` and `deploy` for main's tip only when the tip is newer. It covers a pending deploy replaced in the `deploy-prod` group, and also a merge with no push run at all: on 2026-11-25 a GitHub incident left merge commit ea86627 (PR #56) on main with no push run; it reached production only through the next merge's run, 45656662261 (0b883a5, PR #57). Until the user decides: a cancelled tip deploy is re-run by hand; a tip with no run is deployed by the next push to main. Stays in the backlog.
- `#27 — Decision: 2026-11-25, proposed to the user (not built: it changes the deploy workflow).` Proposed fix: a job with `if: github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'` that fails with an `::error::` telling the person to choose `main` in "Use workflow from", so the run fails visibly instead of skipping every job. Stays in the backlog.
- `#28 — Decision: 2026-11-25, fixed in this story (nginx config only).` nginx answers its own 400 and 413 under `/api/` with AD-9's validation problem (status 400, the API's own body for an invalid request, as the API also turns its own over-limit 413 into), with the AD-19 headers; paths outside `/api/` keep nginx's pages. Pinned by the contract and profile tests. The ticket can close when this merges. Not covered: 414 and 431-class header errors (the client sends fixed short paths and headers), accepted in the report.

**Why 400, not 413:** the closed set (AD-9) has no 413 type, the API already answers its own body-limit error as the 400 validation problem, and 400 is documented on POST and PATCH (and now DELETE), so the contract suite can validate nginx's answer.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: exit 0, including the new I9 integration tests and the updated openapi test.
- `pnpm gen:openapi && git diff --exit-code packages/contract/openapi.json` (after the regenerated file is committed or staged as the tree's version) -- expected: no diff.
- `pnpm test:all` (holding `/tmp/todo-test-stack.lock`) -- expected: exit 0, with the new contract and profile tests passing.
- `docker compose ls` after each todo-test run -- expected: no `todo-test` project.

**Manual checks:**
- The report reads as Always and the first AC say, and its probe tables match what the probes printed.

## Auto Run Result

Status: built.

**Summary.** The whole app's security review for epic-manage-todos is written in `docs/quality/2026-11-25-epic-manage-todos-security.md`: XSS in rendered and edited text (code review plus a Chromium probe on todo-test), injection on PATCH and DELETE, and everything changed since epic 1's review. Findings S1-S11 are each fixed or accepted with a reason, and each of #26, #27 and #28 has a dated decision line. #28 is fixed in nginx: its own 400 and 413 under `/api/` answer AD-9's validation problem. DELETE now documents its 400 (2.2's notes). #26 and #27 are proposed to the user, not built.

**Files changed.**
- `docs/quality/2026-11-25-epic-manage-todos-security.md` (new): the report.
- `apps/web/nginx.conf`: nginx's own 400/413 under `/api/` answer the validation problem through `location = /api/_nginx/invalid-request`.
- `apps/api/src/routes/todos.ts`: DELETE documents 400; the `TodoParams` comment corrected (an over-long id is a 400).
- `packages/contract/openapi.json`: regenerated.
- `apps/api/test/integration/{update-delete,openapi}.test.ts`, `apps/api/test/contract/todos.contract.test.ts`, `apps/api/test/profile/headers.profile.test.ts`, `apps/api/test/openapi-schema.ts`: I9/I12 tests for the matrix.

**Review (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment).** 25 findings: high 0, medium 1, low 23, false 1. Patched 18 (medium 1, low 17), deferred 0, rejected 7: plan-task wording (fix edits the plan), redundant no-echo assertions (harmless), chunked over-limit form (same nginx line already pinned), `//api/` / `%61pi` spellings (no client sends them; documented as not covered), backlog ticket lines (the orchestrator records them), no committed browser XSS test (epic 1's accepted approach), and the "cautious small" reading (false).

**Follow-up review recommended:** false. One medium and no high patched.

**Verification.** `pnpm typecheck` exit 0; `pnpm test` exit 0 (561 tests); `pnpm gen:openapi` leaves `openapi.json` unchanged; `pnpm test:all` exit 0 under `/tmp/todo-test-stack.lock` on the final tree (contract 16, e2e 117, axe 156 scans, profile, contract-unavailable, scenario coverage all passed); todo-test torn down. The chunked-400 contract test was shown to fail with 400 removed from the location's `error_page`.

**Residual risks.** What Cloudflare's edge answers in front of nginx for malformed or oversized `/api` requests is unverified (no production probe). Some nginx-own errors under `/api/` still return HTML (listed in S9 and the #28 line). The spine's AD-4 and AD-6 now lag the code (architect note in the report).

