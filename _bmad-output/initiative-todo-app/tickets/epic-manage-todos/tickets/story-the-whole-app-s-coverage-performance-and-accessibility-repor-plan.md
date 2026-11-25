---
title: "The whole app's coverage, performance and accessibility reports are written, with every finding settled"
type: chore
ticket: '9'
created: '2026-11-25'
status: built
baseline_revision: '32c336542b843fdf53526b1f6bf88eb455fad5d9'
route: full
route_source: auto
risk: medium
review: thorough
review_source: auto
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/docs/quality/2026-11-25-epic-todo-foundation-coverage.md'
  - '{project-root}/docs/quality/2026-11-25-epic-todo-foundation-performance.md'
  - '{project-root}/docs/quality/2026-11-25-epic-todo-foundation-accessibility.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic manage-todos added edit, complete, reactivate and delete (PATCH, DELETE, the edit field, the Delete confirm, the list states), and the app's quality record stops at epic 1: no whole-app coverage report, no profile of the new actions or endpoints against C4, and no Lighthouse/axe report or keyboard and screen-reader pass of every core action (R14, R18, R19). The README still describes an add-only app.

**Approach:** Extend the committed measurement scripts so they cover every action and endpoint, run them and `pnpm test:all` on `todo-test`, add a scripted keyboard-only and accessibility-tree pass of Flow 2, and write three dated reports under `docs/quality/` in epic 1's format, each finding fixed or accepted with a reason. Update the README for the new actions, routes and scripts.

## Boundaries & Constraints

**Always:**
- Every shell command starts with `cd /Users/idris/me/todo-wt/story-2-9-quality-reports && export PATH=$HOME/.nvm/versions/node/v26.13.1/bin:$PATH && `. Work only in that worktree on branch `story-2-9-quality-reports`. Never read or write `/Users/idris/me/todo` or another worktree. Do not commit, push or open PRs; the caller does that.
- Docker: only compose project `todo-test` (`docker compose -p todo-test --profile test ...`, `127.0.0.1:8081`). Before any run that uses it (`pnpm test:all`, bringing the stack up for the perf, Lighthouse and a11y-pass scripts), take the lock: `mkdir /tmp/todo-test-stack.lock` (if it fails, someone else holds it: poll every 60 s or so, running only `pnpm test`/`pnpm typecheck` meanwhile), then `echo "#50 story-2-9-quality-reports" > /tmp/todo-test-stack.lock/owner`. Release with `rm -rf /tmp/todo-test-stack.lock` as soon as the run ends and todo-test is down (`docker compose -p todo-test --profile test down -v`; check `docker compose ls`). Never hold it idle, never remove a lock you do not own; record how many times you took it in Implementation Notes.
- Every script that writes todos keeps refusing any host but `127.0.0.1`/`localhost`/`[::1]` before its first request. Nothing ever targets the production hostname.
- Reports are `docs/quality/2026-11-25-epic-manage-todos-{coverage,performance,accessibility}.md`, each with epic 1's header (Date, Epic, Commit measured, Environment where relevant, Tools, Reproduce), Results, and a Findings table (#, Finding, Status, Change or reason; IDs continue per report). Every number in them is copied from a run on the final code, not estimated.
- A fix that changes app behaviour beyond the ticket's scope is not built: record it as `accepted` with "new bug proposed: <title>" and list it in Implementation Notes.

**Never:**
- Edit `.github/workflows/*`, README's "Deploy" and "Roll back" sections (another change is editing them), secrets, the host, the tunnel, `compose.yml`'s production settings, the architecture spine, or any `_bmad-output/` file other than this plan.
- Gate `pnpm test:all` or CI on a coverage percentage or on the perf scripts (they stay manual, epic-close tools).
- Test-only routes or flags in app code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Action profile | `pnpm perf:actions` on todo-test | add, edit, complete, reactivate, delete each timed over ≥ 5 runs at desktop 1280×720 and Pixel 7; table of input→DOM and input→next frame per run, medians; exit 0 when every run's input→next frame < 100 ms | exit 1 naming the action and run when one is ≥ 100 ms or the change never shows |
| API profile | `pnpm perf:api` | `GET /api/health`, `GET /api/todos`, `POST /api/todos`, `PATCH /api/todos/{id}`, `DELETE /api/todos/{id}`, each ≥ 100 timed requests, p95 < 300 ms | exit 1 on any non-2xx or a p95 ≥ 300 ms (unchanged rule) |
| Non-local host | `BASE_URL=https://example.com` on `perf:actions`, `perf:api`, `perf:lighthouse`, `a11y:pass` | exit 1 before any request | — |
| Lighthouse list | `pnpm perf:lighthouse` | audits a list holding active and completed todos (≥ 10, ≥ 3 completed), prints the counts; four runs (mobile/desktop × light/dark) | exit 1 on any failing accessibility audit (unchanged) |
| Keyboard + a11y-tree pass | `pnpm a11y:pass` on todo-test | Flow 2 steps 1–6 and its failure path by keyboard only; transcript of focused element (role, name, state) after each key, live-region text changes, and an aria snapshot of the card at each state | exit 1 when focus lands on `<body>` or an expected focus target/announcement does not appear |

</intent-contract>

## Code Map

- `docs/quality/2026-11-25-epic-todo-foundation-{coverage,performance,accessibility}.md` -- the formats to follow. Carry forward their findings with today's status: coverage C1–C17 (C5 `useRetryFetch`, C6 helper edit/complete/delete paths, C8 messages, C14 `problems.ts` l.74, C17 `requestRetry` were waiting on this epic: re-check each against the new lcov), performance P1–P7 (P2: re-measure bundle growth), accessibility A2 (the manual pass, now done here).
- `scripts/test-all.mjs` -- writes `coverage/{unit,component,integration}/coverage-summary.json`, `lcov.info`, `coverage/scenarios.md`, `coverage/e2e-report.json`. Read-only for this story.
- `scripts/scenario-coverage.mjs`, `scripts/axe-coverage.mjs` -- scenario table and scan counts for the reports; read-only.
- `scripts/perf-api.mjs` -- add `PATCH /api/todos/{id}` (alternate `{completed}` true/false or a new description on a seeded todo) and `DELETE /api/todos/{id}` (each timed delete removes a todo created untimed just before it; warm-up likewise). Fix the stale "Epic 1 has no DELETE" comment. Keep the fixed 300 ms bar, `PERF_N` ≥ 100, the host guard and the table format.
- `e2e/perf/first-load.mjs` -- pattern for a Playwright+CDP script: host guard, `api()` helper, `instrument`, keydown-timestamp + `MutationObserver` + `requestAnimationFrame` timing of the add action. Leave it as it is.
- `e2e/perf/actions.mjs` (new, `pnpm perf:actions` in root `package.json`) -- the five actions. Time from the triggering input event's `timeStamp` (keydown for Enter, pointerdown for a click) to the change in the DOM and to the next frame: add = new `li` with the text; edit = Edit opened untimed, new text filled, Enter → the card's text span shows it; complete/reactivate = checkbox click → `checked` flips and the Done chip appears/goes; delete = Delete and its confirm opened untimed, Confirm delete click → the row is a Leaving copy (`li[data-leaving]`) or gone. Selectors as in `e2e/helpers.ts` (`editButton`, `deleteConfirm`, `editField`, `completionCheck`). Seed through the public API; reset nothing it did not create.
- `e2e/perf/lighthouse.mjs` -- add the seeding in the matrix before the runs (public API, `crypto.randomUUID()` ids); everything else unchanged.
- `e2e/a11y/keyboard-pass.mjs` (new, `pnpm a11y:pass`) -- Playwright Chromium, `reducedMotion: 'reduce'`, light; keyboard only (`page.keyboard`), no clicks. Per step: `document.activeElement` role/name/`checked`/`aria-expanded` via `locator(':focus').ariaSnapshot()` or CDP `Accessibility.getPartialAXTree`; live-region changes from a `MutationObserver` on every `[role=status]`/`[aria-live]`; the card's `ariaSnapshot()`. Expected names and messages: `e2e/helpers.ts` `MESSAGES`, EXPERIENCE.md Flow 2. Uses its own unique descriptions; never empties the list.
- `apps/web/src/components/TodoCard.tsx`, `EditForm.tsx`, `TextField.tsx`, `TodoList.tsx`, `Announcer.tsx`, `AddForm.tsx` -- what the passes exercise; change only to fix an a11y or performance finding in scope.
- `README.md` -- intro (still add-only), Test › Measurements (add `perf:actions`, `a11y:pass`, PATCH/DELETE in `perf:api`, the run order), Quality reports, and a short list of the API routes (`GET`/`POST /api/todos`, `PATCH`/`DELETE /api/todos/{id}`, `GET /api/health`, contract in `packages/contract/openapi.json`). Not Deploy or Roll back.
- `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md` -- Flow 2 (l.412), Accessibility Floor (l.345, including the "Expected, not bugs" list), Focus management: the pass's expectations. Read-only.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/perf-api.mjs` -- PATCH and DELETE endpoints as in Code Map -- R19 needs every endpoint's p95.
- [x] `e2e/perf/actions.mjs`, root `package.json` -- the action profile and `perf:actions` -- C4's 100 ms per action.
- [x] `e2e/perf/lighthouse.mjs` -- seed active and completed todos -- the audit must see the done styling and card buttons.
- [x] `e2e/a11y/keyboard-pass.mjs`, root `package.json` -- the keyboard and accessibility-tree pass and `a11y:pass` -- R14's manual pass, per the ticket's Notes.
- [x] Measure (lock): fresh todo-test, Chromium installed, then `perf:first-load`, `perf:actions`, `perf:api`, `perf:lighthouse`, `a11y:pass`, check each host guard, `down -v`, release. Then `pnpm test:all` (lock) for coverage, scenarios and axe. Fix in-scope findings and re-measure what they touch.
- [x] `docs/quality/2026-11-25-epic-manage-todos-coverage.md` -- per-project lines/branches/functions/statements, the whole catalogue's scenario table from `coverage/scenarios.md`, untagged tests, and every gap (carried and new) closed or accepted.
- [x] `docs/quality/2026-11-25-epic-manage-todos-performance.md` -- API table (5 endpoints), first load and Lighthouse performance, the action table vs 100 ms, findings.
- [x] `docs/quality/2026-11-25-epic-manage-todos-accessibility.md` -- Lighthouse table, axe (states scanned per spec, scans per project, violations), the keyboard pass and the accessibility-tree pass (focus order, names, roles, states, every live-region message, against Flow 2 and the Accessibility Floor), a scope note that an agent cannot drive a real screen reader, and the dated line: `User screen-reader check — pending (optional; may be run in spike 13's TalkBack session or on desktop; any failure becomes a new bug).`
- [x] `README.md` -- as in Code Map.

**Acceptance Criteria:**
- Given `docs/quality/`, when the story closes, then the three reports exist, name epic-manage-todos, and every finding in each is `fixed` or `accepted` with a reason.
- Given the performance report, when read, then each of add, edit, complete, reactivate and delete shows its measured times with every run under 100 ms, and every endpoint shows n ≥ 100 and p95 < 300 ms.
- Given the accessibility report, when read, then all four Lighthouse runs show 0 failed accessibility audits, axe shows 0 violations, and the keyboard and tree pass covers every Flow 2 step with no unexplained failure.
- Given the final tree, when `pnpm typecheck`, `pnpm test` and `pnpm test:all` run, then each exits 0.

## Implementation Notes

- Stack lock `/tmp/todo-test-stack.lock` taken **2 times**: (1) a fresh `todo-test` for the measurement scripts: a development pass of each script, then `down -v`, a fresh `up --build --wait`, and the final sequence `perf:first-load`, `perf:actions`, `perf:api`, `perf:lighthouse`, `a11y:pass` (all exit 0), the four host guards with `BASE_URL=https://example.com` (all exit 1 before any request), `down -v`, released; (2) `pnpm test:all` (exit 0), `down -v`, released. `docker compose ls` showed no `todo-test` after each.
- No app source changed: no finding needed an app fix, so the numbers are `32c3365`'s app. `pnpm typecheck` and `pnpm test` (561 tests) exit 0; `pnpm test:all` exit 0 (unit 270, component 169, integration 122, contract 16, e2e 117, profile 20, contract-unavailable 10; axe coverage 117 tests, 156 scans).
- Findings: coverage C1–C21 (C5, C6, C8 fixed by this epic's tests, the rest accepted), performance P1–P9 (P1, P8 fixed; P8 is the `perf:first-load` fix below), accessibility A1–A5 (A1, A2 fixed). No "new bug proposed": nothing found needed a change to app behaviour.
- `pnpm test:all` empties `coverage/` at its start, so the Lighthouse JSON of the final run is gone; the report's audit counts were read from it before `test:all` ran.
- Review fixes (step 4, applied in the main session): `actions.mjs` times the painted frame (a message posted from rAF), fails on any `/api` 4xx/5xx, true median, throwing `api()` and warn-only clean-up; `keyboard-pass.mjs` records `role` alert/log too, requires each expected message exactly once, reads back the stored todos after step 5 and after 2 s of quiet at the end, sets up inside `try`, cleans up by run stamp, null-safe tree reads; `perf-api.mjs` times PATCH for `completed` and for `description` (two rows); new `apps/api/test/profile/measurement-guards.profile.test.ts`; reports and README wording (P10, P11 added; A4 reason; Lighthouse and pass scope). The lock was taken twice more for this: (3) a fresh stack and the full sequence `perf:first-load`, `perf:actions`, `perf:api`, `perf:lighthouse`, `a11y:pass` (all exit 0), `down -v`, released; (4) `pnpm test:all` exit 0 (unit 270, component 169, integration 122, contract 16, e2e 117, profile 25, contract-unavailable 10; axe 117 tests, 156 scans), stack down, released. **Lock taken 4 times in all**; `docker compose ls` empty after each. Every number in the three reports is from runs (3) and (4).
- The profile step of `pnpm test:all` printed `Error response from daemon: Container … is not paused` once (the stalled-API test's unpause in teardown); every profile test passed. Not a finding of this story; noted in case it recurs.

## Plan Change Log

- `e2e/perf/first-load.mjs` was to be left as it is, but it no longer finished: its add check compared a card's whole `textContent` with the description, and cards now also hold Edit and Delete. One line changed to match the card's text span (performance finding P8). Nothing else in it changed.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 38 findings — high 0, medium 2, low 32, false 4, maybe-false 0 (7 intent-alignment divergences triaged as findings)
- findings:
  - `[medium]` `[patch]` (blind-hunter) `actions.mjs` stops the gated "frame" time in a rAF callback, before that frame paints, while the report says "painted frame". — Patched: the time is taken in a message posted from the rAF callback (after style, layout and paint); the whole sequence was re-measured on a fresh stack and every table updated (slowest 53.1 ms).
  - `[low]` `[patch]` (blind-hunter) The Pixel 7 profile does not throttle the CPU and the report does not say so. — Patched: script header and report say so; new finding P10, accepted with its margin.
  - `[low]` `[patch]` (blind-hunter) The report states why complete/reactivate are slower without a trace. — Patched: the report cites the code (`cancelQueries(...).then(applyToCache)`), says the frame-aligned wait is untraced; new finding P11, accepted.
  - `[low]` `[patch]` (blind-hunter) The keyboard pass never reads back what the server stored and has no quiet period for a late rollback announcement. — Patched: read-back after step 5 and at the end, after 2 s of quiet in which no outcome message may appear.
  - `[low]` `[patch]` (blind-hunter) `recordLiveRegions` misses `role="alert"`/`"log"` and labels any other live region "Announcer". — Patched: both roles recorded, other regions labelled by role and counted as outcome messages. (The app has none today.)
  - `[low]` `[patch]` (blind-hunter) The pass accepts an expected announcement said twice. — Patched: exactly once is required.
  - `[low]` `[patch]` (blind-hunter) The pass walks one setting and Flow 2's keys only, but the report reads wider (no trap, tab order, motion-on Leaving path). — Patched (report): states what the pass does not walk and which tests cover it (E8 projects; K4/K6 component tests for the motion-on Leaving row, which no browser test walks).
  - `[low]` `[patch]` (blind-hunter) Setup/clean-up errors exit and lose the real failure; the anchor todo leaks if Chromium fails to launch; `!confirmButton` is dead. — Patched: `api()` throws in both scripts, setup moved inside `try`, clean-up errors are warnings after the real failure, dead check removed.
  - `[low]` `[patch]` (blind-hunter) Lighthouse's list size (279) depends on the run order, presented as controlled. — Patched (reports): both say the size comes from the run order (`perf:api` first).
  - `[low]` `[patch]` (blind-hunter) `perf:api` times PATCH only for `completed`, never a description change. — Patched: a second PATCH row (`description`, n = 200), re-measured.
  - `[low]` `[patch]` (blind-hunter) README intro claims WCAG 2.2 AA outright. — Patched: "built to WCAG 2.2 AA and checked with axe, Lighthouse and a keyboard pass; automated checks cover only part of WCAG".
  - `[low]` `[patch]` (blind-hunter) A4 is accepted on an untested speech claim. — Patched: A4's reason no longer claims how speech sounds; it defers that to the pending screen-reader check (A3).
  - `[false]` `[reject]` (blind-hunter) The plan lists four lenses but no triage log; it holds machine-local paths. — The log is written by this pass; the paths are the run's own boundaries, as in every plan beside it, and the fix would edit this plan.
  - `[medium]` `[patch]` (verification-gap) The write-capable scripts' local-host guards have no test. — Patched: `apps/api/test/profile/measurement-guards.profile.test.ts` spawns all five scripts with `BASE_URL=https://example.com` and asserts exit 1, no stdout, and the refusal on stderr; runs in every `pnpm test:all` (profile project, no stack needed).
  - `[low]` `[patch]` (verification-gap) A clean-up error in `finally` replaces the real failure message. — Same root cause as the setup/clean-up row; patched there.
  - `[low]` `[patch]` (verification-gap) `median` returns the lower middle for an even `PERF_RUNS`. — Patched: the mean of the two middle values.
  - `[low]` `[patch]` (verification-gap) `actions.mjs` treats any `/api/` 404 as success. — Patched: every 4xx/5xx fails the run.
  - `[low]` `[patch]` (verification-gap) The new scripts' refusal messages omit `[::1]`. — Patched.
  - `[low]` `[patch]` (edge-case-hunter) Anchor todo leaks when the browser setup throws. — Same root cause as the setup/clean-up row; patched there.
  - `[low]` `[patch]` (edge-case-hunter) The todo Flow 2 adds through the page is not cleaned up when the pass fails before its id is known. — Patched: clean-up also deletes every todo whose description carries the run stamp.
  - `[low]` `[patch]` (edge-case-hunter) `describe(null)` throws when the focused Cancel has no group. — Patched: null-safe message before the check.
  - `[low]` `[patch]` (edge-case-hunter) `describe(null)` throws when the page has no `h1`. — Patched: `describe` handles null and the check fails with its own message.
  - `[low]` `[patch]` (edge-case-hunter) `axOf` throws on an empty `nodes` array. — Patched: returns null.
  - `[false]` `[reject]` (edge-case-hunter) `settle()` in the keyboard pass can loop forever on a request that never ends. — Every request is to the local nginx: `/api` requests end within its 10 s `proxy_read_timeout` (and the client aborts writes at 15 s), assets are static, so `requestfinished`/`requestfailed` always fires.
  - `[false]` `[reject]` (edge-case-hunter) Same for `actions.mjs`' `settle()`. — Same refutation.
  - `[low]` `[patch]` (edge-case-hunter) A failing `seed()` inside `try` exits before `finally`. — Same root cause as the setup/clean-up row; patched there.
  - `[low]` `[patch]` (edge-case-hunter) `actions.mjs` clean-up failure masks the run's failure. — Same root cause; patched there.
  - `[low]` `[patch]` (edge-case-hunter) Keyboard-pass clean-up failure masks the pass's failure. — Same root cause; patched there.
  - `[low]` `[patch]` (edge-case-hunter) 404 carve-out in `actions.mjs`. — Same as the verification-gap row; patched.
  - `[low]` `[patch]` (edge-case-hunter) Even-run median. — Same as the verification-gap row; patched.
  - `[low]` `[patch]` (edge-case-hunter) `at === -1` picks `rows[0]` as the next todo. — Patched: returns null.
  - `[low]` `[patch]` (intent-alignment) Action timing sits at a pre-paint rAF proxy on desktop CPU, not user-perceived paint on a phone. — Same root causes as the first two blind-hunter rows; patched there.
  - `[low]` `[patch]` (intent-alignment) Lighthouse audits only the loaded page, not every state. — Patched (report): says what Lighthouse sees and that the other states are audited by axe in e2e.
  - `[low]` `[patch]` (intent-alignment) The tree pass hears only Flow 2's messages, not every live-region message in the app. — Patched (report): states the pass's scope and where each other message is asserted (E6, K5, K7).
  - `[low]` `[patch]` (intent-alignment) The tree pass leaves out the empty-list branch, phone, dark and motion-on. — Same root cause as the blind-hunter scope row; patched there.
  - `[low]` `[reject]` (intent-alignment) The Verify line is met by manual script runs, not gates in `pnpm test:all`/CI. — By design: AD-20 runs Lighthouse and the C4 profile at each epic's close, the test strategy gates nothing on these, and the scripts need a quiet machine. The guard test now runs in `test:all`.
  - `[false]` `[reject]` (intent-alignment) The measured commit may not be the final code while entries 15–17 build in parallel. — Entries 15–17 change only `.github/workflows/ci.yml` and README's Deploy section; no app source.
  - `[low]` `[patch]` (intent-alignment) PATCH's description path is not timed. — Same as the blind-hunter PATCH row; patched there.

## Design Notes

Gate on every run's input→next frame (not the median): the ticket says every action shows within 100 ms. Medians are reported too. The scripts stay outside `pnpm test:all` and CI, like epic 1's: they need a quiet machine and are epic-close tools (AD-20).

The keyboard pass is a committed script, not a one-off, so the next epic or the user can rerun it; its transcript is the evidence and the report adds the judgment against EXPERIENCE.md (including its "Expected, not bugs" list, which cannot be checked without a real screen reader and is stated as such).

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: exit 0.
- `pnpm perf:actions`, `pnpm perf:api`, `pnpm perf:lighthouse`, `pnpm a11y:pass` on a fresh todo-test (lock held) -- expected: each exit 0; and each with `BASE_URL=https://example.com` exits 1 before any request.
- `pnpm test:all` (lock held) -- expected: exit 0.
- `docker compose ls` after each run -- expected: no `todo-test`.

**Manual checks:**
- Each report's numbers match the printed output of the final runs.

## Auto Run Result

Status: built.

**Summary.** The whole app's coverage, performance and accessibility reports for epic-manage-todos are written under `docs/quality/`, each finding fixed or accepted with a reason. The measurement scripts now cover every action and endpoint: `perf:actions` (new) times add, edit, complete, reactivate and delete to the painted frame, gated at 100 ms per run; `perf:api` adds PATCH (both kinds) and DELETE; `perf:lighthouse` audits a list with done todos; `a11y:pass` (new) is the keyboard-only and accessibility-tree pass of Flow 2 and its failure path. The README describes the full app, its routes and the new scripts. No app source changed: no finding needed an app fix, and no new bug is proposed.

**Files changed.**
- `docs/quality/2026-11-25-epic-manage-todos-{coverage,performance,accessibility}.md` (new): the three reports (C1–C21, P1–P11, A1–A5).
- `e2e/perf/actions.mjs` (new), `e2e/a11y/keyboard-pass.mjs` (new): the action profile and the keyboard/tree pass.
- `scripts/perf-api.mjs`: PATCH (`completed`, `description`) and DELETE.
- `e2e/perf/lighthouse.mjs`: seeds ≥ 10 todos, ≥ 3 done.
- `e2e/perf/first-load.mjs`: one-line selector fix (P8).
- `apps/api/test/profile/measurement-guards.profile.test.ts` (new): every measurement script refuses a non-local host.
- `package.json`: `perf:actions`, `a11y:pass`. `README.md`: intro, routes table, Measurements, Quality reports (Deploy and Roll back untouched).

**Review (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment).** 38 findings: high 0, medium 2, low 32, false 4. Patched 33 (medium 2: the pre-paint frame timing, the untested host guards; low 31). Deferred 0. Rejected 5: the plan's own lenses/paths (false; would edit this plan), the two `settle()` hang claims (false: nginx's 10 s `proxy_read_timeout` and static assets end every request), the measured-commit concern (false: entries 15–17 touch only ci.yml and README Deploy), and the manual-gates divergence (low, by design per AD-20 and the test strategy).

**Follow-up review recommended:** true (first pass, two medium entries patched). Unverified risk: the error and clean-up paths rewritten in `e2e/perf/actions.mjs` and `e2e/a11y/keyboard-pass.mjs` (`api()` throwing, setup inside `try`, warn-only clean-up, the 4xx/5xx fail rule, the late-announcement and read-back checks) were exercised only on the success path; no run forced a failure through them.

**Verification.** `pnpm typecheck` exit 0; `pnpm test` exit 0 (561); on a fresh todo-test under the lock, `perf:first-load`, `perf:actions`, `perf:api`, `perf:lighthouse` and `a11y:pass` each exit 0; each refuses `BASE_URL=https://example.com` with exit 1 (now also the profile test, 5 passing); `pnpm test:all` exit 0 on the final tree; `docker compose ls` empty after each run, lock released (taken 4 times).

**Residual risks.** No phone-hardware CPU was measured (P10). Lighthouse sees only the loaded list; other states rest on axe. No real screen reader was driven (A3); the user's check is a pending line in the accessibility report. Lighthouse's `bf-cache` failure is a host memory-pressure reason (P7).
