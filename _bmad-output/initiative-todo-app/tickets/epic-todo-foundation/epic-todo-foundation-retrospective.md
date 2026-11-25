---
epic: epic-todo-foundation
date: 2026-11-25
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: epic-todo-foundation

"A todo is saved and comes back, deployed and tested": the platform baseline and tracer path of the Todo App initiative. Headless run. Every finding below cites a file, line, commit or plan. Where a finding came from a sub-agent, it was checked again against HEAD `596a2f1` before being kept here.

## Epic summary

**Epic:** `_bmad-output/initiative-todo-app/tickets/epic-todo-foundation/` (tickets.py epic id 1). It has Requirements (R1–R3, R7, R8, R10–R12, R14–R22), Constraints C1–C12 and a Done when list, so the criteria are **declared**.

**Tickets, in build order.** All nine are finished, each with `status: built` and `state: done`. `pending_tickets` is empty.

| Ref | Title | Status / state | Plan range (baseline → next baseline) | Commits in range |
|---|---|---|---|---|
| 1.1 | A todo added in the browser is still there after a refresh, tested at every layer | built / done | `0418343..1b26f5d` | `ec01dba`, merge `1a017fe` (PR #13), `1b26f5d` |
| 1.2 | A green push to main deploys the tested images behind the Cloudflare Tunnel | built / done | `1b26f5d..4f16aa5` | `50a3305`, merge `0cf48a8` (PR #14), `dd49ee2` + revert `c84141e` (red-push proof on `main`), `7678f68`, `5c747c8`, merge `da7ecf3` (PR #15), `4f16aa5` |
| 1.3 | The API refuses an invalid or conflicting create with a problem response | built / done | `4f16aa5..26c0384` | `4813413`, merge `ff7f858` (PR #16), board commits |
| 1.4 | The add form cleans and checks a description before sending it | built / done | `26c0384..197cbf3` | `dbca6e6`, `9699de1` (CI fix), merge `3c522bb` (PR #17), board commits |
| 1.5 | Failures are classified, and the announcer reports a failed refresh | built / done | `197cbf3..40a461b` | `d0d2ac4`, `f907e02` (CI fix), merge `939ca3d` (PR #18), board commits |
| 1.6 | An add shows at once and reverts with a message when saving fails | built / done | `40a461b..ba9081c` | `c5bf4ed`, merge `7947098` (PR #19), board commits |
| 1.7 | Every profile starts healthy and hardened, with readable logs, and todos survive a restart | built / done | `ba9081c..8ead029` | `64a3ac3`, `26f7d37` (test:all fix), merge `963e35e` (PR #20), board commits |
| 1.8 | Refactor sweep | built / done | `8ead029..b410ca9` | `395dc97`, merge `5e40268` (PR #21), board commits |
| 1.9 | Epic 1's quality reports and README are written, with every finding settled | built / done | `b410ca9..596a2f1` (inferred: the last plan runs to HEAD, and no later work has landed) | `b7a2106`, `e96a258`, `e2894d7`, merge `63f0d3d` (PR #22), `596a2f1` |

**Ranges.** The plans' baselines are strictly ordered in history, each an ancestor of the next. No two plans share a baseline. In every range `merges_measured` equals `merge_count`, and `binary_revisions` is 0 throughout. The evidence came from `.agents/skills/bmad-retrospective/scripts/git_evidence.py`, run once per range.

**Evidence inventory**

- Read in full: the epic file, all nine story files and nine plans (frontmatter, decisions, Implementation Notes, Plan Change Log, Review Triage Log, Verification, Auto Run Result), `tickets.toml` through `tickets.py status` and `find`, and the four reports under `docs/quality/`.
- Read where cited: README.md, the AD-6 and AD-18 sections of the architecture spine, `.github/workflows/ci.yml`, `compose.yml`, `.env.example`, `apps/web/nginx.conf`, and the source files named in Findings.
- Run folders: none in the epic folder. Companions: none (`companions: []`).
- Previous retrospective: none. This is the first epic in the `epics` order.
- Session logs: 39 session transcripts exist under `~/.claude/projects/-Users-idris-me-todo/*.jsonl`, the latest dated 2026-11-25. They are not mapped to tickets and were **not mined**, so the process lessons below come from the plans' logs and commits only (narrowed scope).
- `_bmad-output/initiative-todo-app/deferred-work.md` is empty at HEAD. Story 1.8 cleared its last three lines.

## Findings

Dispositions: **fix now** becomes an action item; **defer** carries enough context to act on later; **accept** is recorded so later retros stop re-flagging it. "Prevent" is the upstream lesson.

### Spec-to-implementation reconciliation

- **F1. Done when bullet 2 is not literally met: 5 of the 12 e2e tests run no axe scan.**
  - Sources: `e2e/validation.spec.ts:82`, `:99`, `:118`, `:155` (four of its six tests; axe runs only at `:74` and `:198`) and `e2e/motion.spec.ts` (one test, no axe). The Done when asks for "axe-core in every e2e test in both colour schemes".
  - The accessibility report's statement that every state is audited is therefore too strong (`docs/quality/2026-11-25-epic-todo-foundation-accessibility.md`, axe section).
  - Mitigation: the states those tests reach (text in the field with the counter, a card just added) are close to states scanned elsewhere: `'over limit'` (`validation.spec.ts:198`), `'added'` (`todos.spec.ts:69`) and `'loaded'` (`todos.spec.ts:39`). Lighthouse scored 100 accessibility with 0 failures in all four runs.
  - Disposition: **fix now** (A1). Prevent: when a ticket has a "every test does X" clause, the 1.8 refactor sweep or the 1.9 report check should grep for it. Story 1.4 added four tests without the scan, and no review caught it.
- **F2. AD-18 contradicts itself, and the as-built deviates from it without a record.**
  - AD-18 says the deploy job pushes to GHCR, then logs the host in with the job's `GITHUB_TOKEN` "(`packages: read`)" (`architecture-todo-app.md:198-205`). One job token has one permission set, so the job runs with `packages: write` (`.github/workflows/ci.yml:93`).
  - Story 1.2's review rejected the finding and said it was "surfaced to the user as follow-up" (1.2 plan, Review Triage Log #3). No ticket, deferred-work entry or security-report line records that follow-up. `grep -ri 'packages: read'` finds it only in the architecture file, the memlogs and the 1.2 plan.
  - Disposition: **fix now** as a spec reconciliation (A2). Prevent: a "surfaced as follow-up" note in a triage log needs a home in the tracker.
- **F3. The AD-20 per-test list reset is replaced by unique descriptions until epic 2's DELETE exists** (`e2e/todos.spec.ts:4-8`; 1.1 plan, Decisions, 2026-11-24 user). Disposition: **accept**, since this was a user decision. Epic 2 owns the reset.
- **F4. Ordering is done in both the repository and the service** (`apps/api/src/todos/repository.ts:34`, `service.ts:6-12`). AD-10 gives ordering to the service. The 1.1 Design Notes chose both deliberately (U2). Disposition: **accept**.
- **F5. Two test layers exist that AD-20 does not list: `profile` and `contract-unavailable`** (`scripts/test-all.mjs:98`, `:102`). Both are behind `pnpm test:all` and pass. Disposition: **accept**, and record it in AD-20 when the spine is next amended (A2 covers the amendment pass).
- **F6. C7: project names depend on `-p` and there is no top-level `name:`.** Running compose without `-p` from a checkout named `todo` would target the prod project name. Source: `compose.yml:1-4`, whose header documents the `-p` for each environment. Disposition: **defer** (low; documented, and every script passes `-p`).
- **F7. Dark mode runs only on desktop.** The Playwright projects are desktop, phone and desktop-dark, with no phone-dark (`e2e/playwright.config.ts:25-38`). R14 asks for both schemes, which desktop meets. Disposition: **accept**.
- **Met in the evidence:** R1–R3, R7, R8, R10–R12, R15–R17, R19–R22, and C1 (by design, through `todos/repository.ts`), C6, C9 and C10. Every R17 scenario id appears in test titles, and `coverage/scenarios.md` lists 21 ids from 321 tests (local run, below). R18's gaps C1–C17 are each accepted with a reason in the coverage report. R19: n = 200 per endpoint, every p95 ≤ 0.7 ms. R20: S1–S5 settled in the security report.

### Diff-scope review: adversarial, edge-case and verification-gap lenses, weighted to boundaries between stories

The `bmad-review` skill was loaded, but its lens sub-agents were not spawned. The three lenses ran in one sub-agent over the whole epic diff (narrowed scope; CSS, token files and some test bodies were not reviewed). Each item below was checked at HEAD.

- **R1. Medium. The client never re-sends with the same id, so AD-6's idempotent replay cannot stop duplicates.** Boundary 1.3 ↔ 1.6.
  - `addTodo` mints a new `crypto.randomUUID()` on every call (`apps/web/src/todos/mutations.ts:204-206`).
  - A create whose response is lost (connection drop or 504) after the API committed reverts, restores the text, and a resubmit stores the todo twice. AD-6 lists "a retry or double-submit being reported as a failure" among what it prevents (`architecture-todo-app.md:85`). Only the API tests exercise replay.
  - Disposition: **defer** to epic 2, before edit and complete build on the helper (A3). Prevent: a story that builds a server guarantee (1.3) should name the client story that relies on it.
- **R2. Medium-low. The create request has no timeout, and nginx bounds only the connect.** Boundary 1.6 ↔ 1.7.
  - `createTodo` sends no `signal` (`apps/web/src/api/client.ts:111-117`). `nginx.conf:43` sets only `proxy_connect_timeout 1s`, so a stalled API holds the optimistic card for up to nginx's default 60 s read timeout.
  - While `pendingCount > 0`, the focus, reconnect and Try again refetches are blocked.
  - Disposition: **defer** (A3).
- **R3. Medium-low. The header profile test covers only `/` and `/api/health`** (`apps/api/test/profile/headers.profile.test.ts:16`).
  - Not covered: `/assets/*` (1.9's `expires 1y` location), a missing asset returning 404, and the 503 unavailable location. An `add_header` inside `location /assets/` would silently drop the CSP and the other headers there, which is what `nginx.conf:11-12` warns about.
  - Report P1's caching fix was checked by hand with `curl` only.
  - Disposition: **fix now** (A4).
- **R4. Low. Storage failures on list and create return 500 `internal`, not 503 `unavailable`.** Only `/health` wraps storage errors in `UnavailableError` (`apps/api/src/problems.ts:95-104`; `routes/health.ts:26-30`). Boundary 1.3 ↔ 1.5: the user sees "something went wrong on our side" while health says unavailable. Disposition: **defer**.
- **R5. Low. `APP_ENV` is validated but has no effect, and `.env.example` claims otherwise.**
  - `config.ts:35-38` requires it, and nothing in `app.ts` reads it. `.env.example:9` says it "Changes log formatting only".
  - Disposition: **fix now** (A5): either use it or drop the requirement and the claim.
- **R6. Low. The README names "Docker with Compose v2", but `compose.yml` uses `profiles: !override` (`:59`, `:69`, story 1.7) and `start_interval`.** These need Compose ≥ 2.24.4 and Engine ≥ 25. The deploy copies the whole file to the host, which already deploys successfully today. Disposition: **fix now** in the README (A5).
- **R7. Low. Re-running a failed deploy more than a day later fails, because the tested images are kept for `retention-days: 1`** (`ci.yml:78`) and downloaded before the GHCR push. Disposition: **defer**, and note it in the README's rollback section.
- **R8. Low. The README says pino writes "one JSON line per request". Fastify writes two, "incoming request" and "request completed".** The "never contain todo text" check covers successful requests only (`apps/api/test/profile/logs.profile.test.ts:9-31`). Disposition: **fix now** in the README (A5). Defer the error-path log test.
- **R9. Low. `MutationSpec.position` is declared but ignored.** `applyToCache` always inserts at the top (`mutations.ts:26`, `:108`). Epic 2 could rely on the field. Disposition: **defer** to epic 2's first story that uses the helper (A3).
- **R10. Low. Truncating todo text at 40 code points can split a grapheme in the Announcer text** (`apps/web/src/todos/messages.ts:11-15`). Disposition: **defer**.
- **Checked and holding up:** the problem-type map is compile-checked against the contract, media-type parsing works with and without a charset, the cancel-before-apply ordering and settle refetch, abort handling, the trim and forbidden-character rules agree between client and server, the nginx 502/503/504 mapping to unavailable runs against the real stack, the deploy guard reads the running container's tag (`ci.yml:143-158`; the 1.2 review's patch landed), and the host `.env` is written whole from secrets.

### Rejected-but-real findings carried in plan triage logs, with no tracker home

These were confirmed real and rejected as "more than a direct correction". Each is low.

- Out-of-order deploys can leave the tip of `main` cancelled, with no deploy (1.2 triage #1).
- A `workflow_dispatch` from a non-`main` branch does nothing, silently (1.2 #4).
- nginx's own 4xx responses under `/api/` are HTML, not problem bodies (1.3; accepted as S3 in the security report).
- A multi-line drop into the field loses Chrome's undo step (1.4).
- Shift+Enter over an IME submits (1.4 follow-up).

Real Android IME behaviour stays untested (1.1 #2, 1.4 maybe-false). Story 1.8 (`395dc97`) proved the composing-Enter path with trusted keys in Chromium only.

Disposition: **defer**, with all of them moved into the backlog (A6). Prevent: see P3.

### Aggregate views

- **Architecture delta.** Derived by hand from the imports, not by a dependency tool (narrowed scope).
  - API: `server → app → {problems → errors, routes/*, todos/service → todos/repository → db/*}`. The service imports no Fastify, and only the repository and `db/` touch Drizzle.
  - Web: `main → App → components → todos/hooks → {TodosProvider, query, mutations, store, announcer} → api/client`. No component imports `api/client`. `@todo/contract` is imported as types only, apart from `@todo/contract/description`, which AD-5 allows.
  - No cycles and no layering violations. Minor: `FailureKind` lives in `api/client.ts:19` and is imported by `store.ts` and `messages.ts`. Disposition: **accept**.
- **Duplication map**
  - The AD-4 unavailable body appears five times: `nginx.conf:56`, `api/src/problems.ts:32-37`, `api/test/openapi-schema.ts:18`, `e2e/add-failure.spec.ts:13`, `e2e/refresh.spec.ts:14`.
  - The problem type URIs are in three tables (`contract/problem.ts`, `api/problems.ts`, `web/api/client.ts`); the last two are `satisfies`-checked.
  - `PROBLEM_MEDIA_TYPE` is defined in both the API and the web.
  - The e2e helpers are copied, not shared. `uniqueDescription` and `todoItem` are in four specs, `announcement` in two, and the message strings in three. Only `e2e/axe.ts` is shared.
  - The **same CI-only failure was fixed twice in two stories.** A bare `getByText('Enter a description.')` matched both the Inline error and the Field status, whose text arrives one frame later (`sayAgain`). It was fixed in the e2e spec in 1.4 (`9699de1`, CI run 45529158868), then in the component tests in 1.5 (`f907e02`, CI run 45535291517) with a separate `NOT_STATUS` exclusion.
  - Disposition: **fix now** for the e2e helpers and live-region-safe locators (A7). **Accept** the type tables, which are compile-checked.
- **God-class / size growth.** None. The largest source file at HEAD is `apps/web/src/components/AddForm.tsx`, 331 lines; its churn was +190/−15 in 1.4 and +38/−13 in 1.6. The largest test file is `AddForm.component.test.tsx`, 648 lines, grown in 1.4, 1.5 and 1.6. Disposition: **accept**. Watch `AddForm.tsx` in epic 2.
- **Pattern divergence**
  - 26 tests have no scenario id in their title (`config.test.ts`, `startup.test.ts`, `logs.profile.test.ts:9`, `headers.profile.test.ts:16`), against the Conventions' Tests rule. The coverage report acknowledges them.
  - Profile and unavailable-contract tests sit outside the conventional locations (`apps/api/test/profile/`, `apps/api/test/unavailable/`).
  - Naming, error handling (one handler, `problems.ts:88`) and CSS Modules are consistent.
  - Disposition: **accept**. Record the extra locations with F5.

### Process (from plans and commits; session logs not mined)

- **P1. Every plan pinned review to the single `quick` lens** (`review: quick`, `review_source: pinned`, `lenses_ran: [quick]` in all nine plans), including the seven medium-risk stories.
  - The quick lens did catch real defects: a `bad_plan` loopback in 1.6 and a medium-severity patch in 1.3, 1.4, 1.6, 1.8 and 1.9.
  - It missed the boundary issues R1 and R2 and the axe gap F1, which this retrospective's three-lens pass found.
  - Lesson: let review depth follow risk in epic 2 rather than pinning `quick` (A8).
- **P2. Tests that passed locally failed only on the slower CI runner, three times:**
  - 1.4: an e2e strict-mode match (`9699de1`).
  - 1.5: a component strict-mode match (`f907e02`).
  - 1.7: `contract-unavailable` timed out because of nginx's cached upstream address (`26f7d37`, found by the orchestrator).
  - Each was caught before merge by CI or the orchestrator. Lesson: a project pitfall about live-region duplicates and frame-delayed text (A7, A9).
- **P3. Real findings rejected as "more than a direct correction" have no tracker home.** Eight such items sit only in plan triage logs, and `deferred-work.md` is empty. Lesson: rejected-but-real findings get a backlog entry (A6).
- **P4. What worked.**
  - The 1.6 review caught a design-level defect in the plan's own revert algorithm before epic 2 built edit and complete on it (1.6 Plan Change Log, Loopback 1).
  - The KEEP-patch loopback preserved the passing work.
  - The red-push proof (`dd49ee2`, reverted in `c84141e`) exercised R22's "a failing suite deploys nothing" for real.
  - Every PR merged with a green CI run on `main`.

## Behavior verification

Exercised in this run:

- **`pnpm test:all` at HEAD `596a2f1` on the local machine: exit 0.** Every step passed: todo-test up, unit, component, integration, contract, playwright browsers, e2e, profile, stop api, contract-unavailable, scenario coverage and todo-test down. `coverage/scenarios.md` lists 21 scenario ids from 321 tests.
- **CI:** the six most recent `main` push runs are all `success`. The last, 45550327875 for PR #22, ran both `test` and `deploy` successfully.
- **Production, GET only:** `https://<public host>/api/health` returned `200 {"status":"ok"}`, and `/` returned `200`.
- **Not exercised here:** an add on the deployed app, the new-session and server-restart checks on production, and the red-push check. The add was deliberately skipped so that no data was written to production. These rest on story 1.2's hitl Verify, story 1.9's Auto Run Result ("Production received only GET requests") and the local E1/I6 tests.

## Previous-retro follow-through

Nothing to follow through: **there is no previous retrospective file.** epic-todo-foundation is the first epic in the `epics` order (id 1, with no `after`).

## Action items

All of these are **proposed, not applied**. Code fixes go through the normal dev loop (`bmad-build`). Spec and ticket changes go through `bmad-agent-po` (Sofia) or the architect.

| # | Action | Kind | Owner | From |
|---|---|---|---|---|
| A1 | Add `expectNoAxeViolations` to the four un-scanned tests in `e2e/validation.spec.ts` and the one in `e2e/motion.spec.ts`, or reword the Done when and the accessibility report if a person decides those states are covered. Correct the report's "every state is audited" line either way. | remediation (or spec reconciliation) | dev; po if reworded | F1 |
| A2 | Amend AD-18 so it states the deploy job's token is `packages: write` because the same job pushes, or split out a `publish` job so the host pull really uses `packages: read`. In the same amendment pass, record the `profile` and `contract-unavailable` layers in AD-20. | spec reconciliation | architect (via user) | F2, F5 |
| A3 | Before epic 2 builds edit and complete on the mutation helper: reuse the todo id when a restored add is resubmitted (or key replay on it), give `createTodo` a timeout through an `AbortSignal` and set an nginx `proxy_read_timeout`, and make `MutationSpec.position` either work or go away. | remediation, story-shaped for epic 2 | po (slice into epic-manage-todos), then dev | R1, R2, R9 |
| A4 | Extend `headers.profile.test.ts` to `/assets/<hashed>.js` (security headers plus `Cache-Control`), a missing asset (404) and the 503 location. | remediation | dev | R3 |
| A5 | Docs and config accuracy: `APP_ENV` (use it or drop it, and fix `.env.example:9`); the README's minimum Compose 2.24.4 / Engine 25; the README's two log lines per request; and a note that a deploy re-run is limited by the one-day artifact retention. | remediation | dev | R5, R6, R7, R8 |
| A6 | Move the rejected-but-real findings (the 1.2 #1 and #4 deploy edge cases, the 1.3 nginx 4xx HTML, the 1.4 drop undo and Shift+Enter over an IME, the untested real Android IME, R4, R10) into the backlog, so they live in the tracker and not only in plan logs. | process | po | P3, F2 |
| A7 | Add shared e2e helpers (`uniqueDescription`, `todoItem`, `announcement`, message strings, a visible-only error locator that excludes `[role="status"]`) and use them in every spec before epic 2 adds more. | remediation | dev | duplication map, P2 |
| A8 | For epic-manage-todos, let review depth follow risk instead of pinning the single `quick` lens on medium-risk stories, at least for stories that touch the mutation helper or cross a story boundary. | process | user / orchestrator | P1 |
| A9 | Record a project pitfall (through `bmad-project-context`): text that appears in both a visible element and a frame-delayed live region breaks strict-mode queries on slow CI; use scoped locators. | process | user (via `bmad-project-context`) | P2 |
| A10 | Close the epic on the board. The epic file still says `status: in-progress`, which the retrospective must not change. | process | po (Sofia), confirmed by the user | Epic summary |

## Decision records

Proposed only: this headless run writes no record. No `adr-*.md` file or decisions folder exists in the repository, so each would go in `docs/decisions/`.

| Proposed record | Plan | Commit | Approved / written |
|---|---|---|---|
| `adr-deploy-job-token-has-packages-write.md`: one job pushes and deploys, so the host pull uses a short-lived write token, sent on stdin and logged out in a trap | 1.2 plan, Design Notes and Review Triage Log #3 | `50a3305` | not approved (headless), not written |
| `adr-deploy-skips-a-sha-older-than-the-running-one.md`: the guard reads the running `api` container's image tag and skips an ancestor SHA, so out-of-order runs never roll production back | 1.2 plan, Design Notes and triage #2 | `50a3305` | not approved (headless), not written |
| `adr-mutation-revert-rebuilds-from-the-failed-base.md`: a failed call's revert rebuilds from its base and re-applies later pending calls on the same id, instead of restoring a captured value | 1.6 plan, Plan Change Log Loopback 1 | `c5bf4ed` | not approved (headless), not written |
| `adr-api-runs-typescript-by-node-type-stripping.md`: the API runs `.ts` directly on Node 26 with no emit step, which constrains TS syntax to erasable-only | 1.1 plan, Implementation Notes (the plan gives no reason; the record would say so) | `ec01dba` | not approved (headless), not written |

## Acceptance verdict

**accepted-with-open-items**, against **declared** criteria. The machine verdict was rendered with no human decision.

Evidence for each Done when bullet:

1. **Deployed add, persistence, refusal, revert: met.**
   - Locally, E1 (refresh and new session), I6 (restart), E6/K1 (refusal and failed-add revert) all pass in the test profile.
   - Production is healthy at its public hostname. The add on production rests on story 1.2's hitl Verify, not on this run.
2. **One command; axe in every e2e test in both schemes; coverage gaps settled: met except one clause.** `pnpm test:all` passes. The coverage gaps are settled. 5 of 12 e2e tests run no axe scan (F1). The states they reach are close to scanned states, and Lighthouse finds 0 accessibility failures, so this is treated as an open item (A1), not a blocking failure. A person may judge it otherwise.
3. **Images and profiles: met.** Both Dockerfiles are multi-stage with a non-root user and a `HEALTHCHECK`. Every compose service has a health check and log rotation. The test profile came up healthy in this run.
4. **CI and deploy: met.** CI runs on every push. Deploy requires a successful test job and pushes the tested `:sha` images. Run 45550327875 deployed, and its public health check passed. The red push `dd49ee2` deployed nothing (story 1.2's Verify).
5. **Reports and README: met.** Four reports under `docs/quality/` settle every finding, and the README covers run, deploy, rollback and extend. Accuracy items are in A5.

Open items: A1–A10. None of the deferred findings (R1, R2, R4, R7, R9, R10, F6) breaks a criterion of this epic. A3 is flagged to land before epic 2 relies on the mutation helper.

## Open questions

- **Is F1 an open item, or a failed criterion?** If a person reads "axe-core in every e2e test" strictly, the verdict becomes **rejected** until A1 lands. This is the one call a human answer would change.
- **AD-18: amend the wording, or split a `publish` job (A2)?** The 1.2 review said the trade-off was "surfaced to the user", but no record of the user's answer was found.
- **Should A3 (client id reuse and request timeout) be its own epic-2 story, or folded into the first story that builds edit or complete on the helper?**
- Session logs were not mined, so lessons about why sessions turned (for example the 1.6 loopback) come only from the plans.

## Assumptions

Headless run: every choice below was made without the user.

- **Epic resolution:** the argument `epic-todo-foundation` matched `epics[].slug` in `tickets.py status`. The folder is the parent of `epic_file` from `find 1.1`: `_bmad-output/initiative-todo-app/tickets/epic-todo-foundation/`.
- **`pending_tickets` is empty.** All nine tickets are `state: done`, so no unfinished ticket forced a rejection.
- **Ranges:** the 1.9 range ends at HEAD `596a2f1`, marked inferred. No later work has landed.
- **The machine verdict is accepted-with-open-items, with no human decision.** F1 was judged non-blocking, which is a judgement call (see Open questions).
- **Proposed items:** A1–A10 are proposals. None was applied, and no ticket or plan was edited.
- **Decision records:** all four ADRs are proposed, not written.
- **Behavior check:** only GET requests went to production. No production data was written, so the deployed add was not exercised here.
- **Narrowed scopes:**
  - Diff-scope review: the lenses ran in one sub-agent, not as separate `bmad-review` sub-agents. CSS, tokens and some test bodies were not reviewed.
  - The architecture delta was derived by hand, without a dependency tool.
  - Session logs were not mined.
- **Deferred item from story 1.9:** GitHub's default branch not being `main` was re-checked read-only. `gh repo view` now reports `main`, so it is not carried forward.
