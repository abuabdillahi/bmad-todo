---
epic: epic-manage-todos
date: 2026-11-26
verdict: rejected
criteria: declared
headless: true
---

# Retrospective: epic-manage-todos

A user manages their whole list, instantly, on any device (issue #3). Headless run on 2026-11-26, at the orchestrator's request, after story 2.17 merged (`b167cfe`).

## Epic summary

**Epic:** `_bmad-output/initiative-todo-app/tickets/epic-manage-todos/`, resolved from the slug `epic-manage-todos` through `tickets.py status` (`epics[1]`, id 2).

**Tickets, in build order** (`tickets.py status <folder>`, 2026-11-26):

| Ref | Issue | Type, risk | status / state | PR, merge | Main run |
|---|---|---|---|---|---|
| 2.1 | #42 | story, high | built / done | #52, `b9ae5e9` | 45625204667 success |
| 2.2 | #43 | story, medium | built / done | #53, `9ca01c0` | 45627303115 success |
| 2.10 | #33 | bug, low | built / done | #51, `1d81bd5` | 45628714357 success |
| 2.3 | #44 | story, medium | built / done | #54, `1c60711` | 45635759096 success |
| 2.4 | #45 | story, high | built / done | #55, `dacc657` | 45644264929 success |
| 2.11 | #30 | bug, low | built / done | #56, `ea86627` | none (push event dropped, see P3) |
| 2.12 | #29 | bug, low | built / done | #58, `22d8b84` | 45658376289 success |
| 2.13 | #31 | spike, medium, hitl | (none) / done | no code: the user's run on a real phone | n/a |
| 2.5 | #46 | story, medium (raised to high by its build) | built / done | #57, `0b883a5` | 45656662261 success (also deployed `ea86627`) |
| 2.6 | #47 | story, medium | built / done | #59, `98b0f86` | 45677224517: attempt 1 failed (flaky test, P4), attempt 2 success |
| 2.14 | #60 | bug, low | built / done | #61, `e7cfdb8` | 45681048594 success |
| 2.7 | #48 | story, low (plan raised to medium) | built / done | #62, `cc32daa` | 45689451484 success |
| 2.8 | #49 | story, medium | built / done | #63, `16cdf23` | 45713067680 success |
| 2.15 | #26 | bug, high | **built / in-progress** | #67, `c32ae8d` | 45722930978 success (push path; scheduled path not yet observed) |
| 2.16 | #27 | bug, medium | built / done | #68, `eaf6281` | 45724922604 success |
| 2.17 | #64 | story, medium | built / done | #69, `b167cfe` | 45727428285 success |
| **2.18** | **#65** | story, medium, hitl | **(none) / backlog** | not started: the user's secret move | n/a |
| 2.9 | #50 | story, medium | built / done | #66, `5b3d465` | 45721650865 success |

- **Unfinished (`pending_tickets`):** `2.18` (#65), `status` empty and `state` backlog. It is the user's own hitl step. The epic file's Notes (Decision 2026-11-25, po) and the ticket's Notes (Decision 2026-11-25, user) say the epic's closure does not wait on it, but issue #3 closes only once it is done. Headless, no one confirmed proceeding over it here: see Assumptions.
- **Finished by the build but not called done:** `2.15` (#26), `status: built`, `state: in-progress`. The orchestrator holds #26 open until the first scheduled catch-up run is seen on `main` (ledger, 2026-11-25 entry for PR #67).
- `2.13` has no `status` (a spike, no build) and `state: done`, so it counts as finished.

**Plan ranges.** Each plan's `baseline_revision`, ordered by history; each range runs to the next baseline. `git_evidence.py` ran once per distinct range (output kept in `/tmp/retro2/r*.json` for this run only) and once over the whole epic, `e8b4cad..b167cfe`: 61 commits, 16 merges, 16 measured, no binary revisions.

| Range | Tickets | Notes |
|---|---|---|
| `e8b4cad..0bc3c01` | 2.1, 2.2, 2.10 | three plans share baseline `e8b4cad`, built in parallel |
| `0bc3c01..0a34aa4` | 2.3 | |
| `0a34aa4..1df5613` | 2.4 | |
| `1df5613..ea86627` | 2.11, 2.5 | share baseline `1df5613`; 2.5's merge lies in the next range |
| `ea86627..562e2a2` | 2.12 | also holds 2.5's merge `0b883a5` |
| `562e2a2..0398118` | 2.6 | |
| `0398118..4c478eb` | 2.14 | |
| `4c478eb..58796f0` | 2.7 | |
| `58796f0..32c3365` | 2.8 | |
| `32c3365..ee55a3f` | 2.9, 2.15 | 2.15's recorded baseline `562a8c5` is a branch commit not on `main` (the plan re-opened on its branch, then rebased); its merge-base with `main` is `32c3365`, used here |
| `ee55a3f..d26b582` | 2.16 | |
| `d26b582..b167cfe` | 2.17 | last range cut at `b167cfe`, the last commit of this epic's code; `118d8f4` after it is board bookkeeping |

**Evidence inventory.**

- Read: the epic file; all 18 ticket files and 16 plans (2.13 and 2.18 have no plan); `tickets.toml` through `tickets.py`; the four quality reports `docs/quality/2026-11-25-epic-manage-todos-{accessibility,coverage,performance,security}.md`; the architecture spine (AD-4, AD-6, AD-9, AD-13, AD-18, AD-20, Deferred); the previous retrospective (`epic-todo-foundation-retrospective.md`); the orchestrator's run ledger `/Users/idris/me/todo-wt/epic-2-ledger.md` and its build briefs `brief-*.md` and `build-brief.tmpl`; `gh run list` for `ci.yml` on `main` (read-only).
- No run folders (`<type>-*/`) exist in the epic folder. The epic lists no companions.
- **Session logs:** not available. The ledger and briefs stand in for them; they record decisions and outcomes, not the build sessions' reasoning, so process lessons below rest on the ledger and the plans' logs only.

## Findings

Disposition for each: **fix now**, **defer**, or **accept**, and the upstream lesson where there is one.

### Aggregate view: architecture delta

**F1 (medium) — The architecture spine no longer describes the delivery workflow or the write timeouts that this epic built.** 
- AD-18 (`architecture-todo-app.md:202-216`) still says "One GitHub Actions workflow runs on every push" with two jobs, `test` and `deploy`. As built, `ci.yml` also has a `schedule` trigger (`ci.yml:22-23`, `'17,47 * * * *'`), the `catch-up` and `catch-up-gate` jobs (2.15, `c32ae8d`), the `dispatch-off-main` job (2.16, `eaf6281`) and `environment: production` on `catch-up` and `deploy` (2.17, `b167cfe`). Rollback is no longer "the same deploy run by hand" alone: a rollback stays live only until the next push that runs CI (README Roll back, 2.15).
- The spine's Deferred line (`architecture-todo-app.md:399`) still says a resubmit from the restored add field "mints a new id, which creates a second todo. Accepted in v1." Story 2.1 built the revisit condition: an unchanged resubmit reuses the id (2.1 plan, Design Notes, last bullet; deferred item in its frontmatter). The line is now false.
- Neither AD-4 nor AD-13 records 2.1's client write abort (15 s, `network`) or nginx's `proxy_read_timeout` of 10 s for `/api` (epic Notes, Decision 2026-11-25; 2.1 plan). The spine has no "timeout" entry at all (`grep -i timeout`).
- Cause: the user limited this run's architecture changes to the AD-20 and AD-9 notes, and later the AD-4/AD-6 amendment (epic Notes; commit `2fec682`), so no build could touch the spine.
- Disposition: **defer**, a spec reconciliation for the architect, applied through `bmad-architecture` with the user's consent. Lesson: when a ticket changes the delivery workflow, its Done-when should name the spine update or an explicit hand-off, so the drift is tracked rather than discovered.

### Aggregate view: duplication map

**F2 (low) — The same failure matrix is written five times in e2e specs, and the "hold the PATCH" setup twice.** The `[503 problem, no response]` array with its `route.fulfill`/`route.abort` answers is repeated in `e2e/complete.spec.ts:141-148`, `e2e/edit.spec.ts:267-274`, `e2e/delete.spec.ts:141-148`, `e2e/add-failure.spec.ts:33-37` and `e2e/list-states.spec.ts:55-59`. The held-route block (`let hold … page.route(TODO_PATH, …isPatch… hold(route))`) is at `e2e/complete.spec.ts:69-71` and `e2e/edit.spec.ts:92-94`. This is 2.7's one deferred item (refactor-sweep plan, frontmatter `deferred` and Review Triage Log follow-up row). Each spec was written by a different story (2.1, 2.3, 2.4, 2.5, 2.6), so no session saw all five.
- Disposition: **defer** to the backlog. Test-only, no behaviour risk.
- Counter-evidence that the previous retro's A7 worked: `e2e/helpers.ts` (10 commits in the epic) is imported by every spec, and 2.1's review fixed `announcement()` to exclude the Field status before a strict-mode clash could recur (2.1 plan, Review Triage Log row 3). Story 2.4 extracted `TextField.tsx` for both the add and edit fields, so 2.11's IME fix and 2.12's drop fix each landed once for both fields.

### Aggregate view: size growth

**F3 (low) — No god class; `ci.yml` is the one file whose logic is now dense.** By churn (`git_evidence.py`, whole range), the top non-test source files are `scripts/deploy-catch-up.mjs` (new, 499 lines), `TextField.tsx` (new, 426), `TodoList.tsx` (409, +376 net), `TodoCard.tsx` (339, +316) and `.github/workflows/ci.yml` (379, +145). Read at `b167cfe`, each component has one job (TodoList: list area and states; TodoCard: one card's modes), and `AddForm.tsx` shrank to 81 lines once `TextField` took the field. `ci.yml` grew across three tickets (2.15, 2.16, 2.17) into a job graph whose `if:` conditions only `scripts/ci-workflow-steps.test.ts` (473 lines, evaluating the graph over 40 scenarios) makes reviewable; 2.15's plan carries `warnings: [oversized]`.
- Disposition: **accept**. The job-graph test is the right guard; F1's spine update should describe the graph in prose.

### Aggregate view: spec-to-implementation reconciliation

**F4 (low) — R11's "survives a server restart" is tested for a created todo only.** `apps/api/test/profile/restart.profile.test.ts` (I6) creates a todo, restarts `api`, and checks it is listed unchanged. No test completes, edits or deletes a todo before the restart. Story 2.3's review raised it and rejected it by inference: completion is stored in the same row through the same SQLite path (2.3 plan, Review Triage Log, intent-alignment row on R11). The epic's Done when names "persists after a refresh, a new session and a server restart" for each change.
- Disposition: **fix now** (test only): extend I6 to patch one todo's text and completion and delete another before the restart, and assert both after it. The inference is sound, so this is a verification gap, not a suspected defect.

**F5 (medium, human) — R14's screen-reader pass is not done; the Done when's "manual keyboard and screen-reader pass" is met only in its keyboard and accessibility-tree half.** `pnpm a11y:pass` (2.9, `e2e/a11y/keyboard-pass.mjs`) walks Flow 2 by keyboard and reads the accessibility tree; the accessibility report's A3 accepts that no agent can drive a real screen reader and leaves a dated pending line for the user's own check (`docs/quality/2026-11-25-epic-manage-todos-accessibility.md:16, 110`). A4 (Chromium joins description parts without punctuation) is also parked on that check. This follows the epic's Decision of 2026-11-25 (po, on the user's instruction), so it is a recorded deviation, not a silent one. It lives only in a report line, not in the tracker, which is the gap the previous retro's A6 named.
- Disposition: **defer** to a hitl backlog ticket for the user.

**F6 (low) — The security report's S2 and S3 say the Cloudflare-edge behaviour is "not re-checked" / "not verified", but the orchestrator checked it on production after 2.8 merged.** Ledger, 2026-11-25 entry for PR #63: `http` answers `301` to `https` (S2), an oversized `POST` answers the validation problem through the edge (S3, #28 works), and a `%zz` id gets Cloudflare's HTML `400` (accepted, S9). The report (`docs/quality/2026-11-25-epic-manage-todos-security.md:132-133`) was not updated.
- Disposition: **fix now** (docs only): record the 2026-11-25 edge checks in S2 and S3, with the ledger as source.

**F7 (accepted deviations, recorded so later retros stop re-flagging them)**
- Gboard is untested on Android; the spike ran Samsung Keyboard only. Decision 2026-11-25 (user), 2.13 Notes: reopen only if a Gboard user reports a failure. **Accept.**
- Performance P10 (no phone-class CPU) and P11 (complete and reactivate paint a frame later, untraced) are accepted in the performance report with the slowest action at 53.1 ms against C4's 100 ms. **Accept.**
- The deployed app's UI journeys run on `todo-test`, not on production; production was exercised by API smokes after 2.3, 2.4 and 2.5 and edge checks after 2.8 (ledger). The build briefs forbid pointing e2e at production because `resetList` empties the list (`build-brief.tmpl`, Hard rules). **Accept.**

### Deferred items carried from the plans

**F8 (low) — 2.12: Firefox's one-step undo on a multi-line drop is unverified.** The guarded intercept (`TextField.tsx`) was observed in Chromium and WebKit; Playwright's Firefox would not launch on the build host (2.12 plan, Implementation Notes follow-up and Auto Run Result, Residual risks). In Firefox a multi-line drop falls back to native-plus-clean, which may lose the single undo step. 2.7's Design Notes moved this item to this retrospective. Testing beyond Chromium is out of the test strategy's scope (coverage report C9). The coverage of the fallback itself: `apps/web/test/drop.ts` and the component tests.
- Disposition: **defer** to the backlog as a manual check; low, since the text is still cleaned and only the undo granularity is at stake.

**F9 (medium, unverified) — 2.15: the `deploy-prod` group-cancellation annotation text is matched on documented wording never seen on this repo.** `scripts/deploy-catch-up.mjs` (`GROUP_CANCELLATION`) matches `higher priority waiting request for '(deploy|***)-prod'`; no run on this repo has ever been cancelled (2.15 plan, frontmatter `deferred`). If the wording differs, a group-cancelled tip is read as deliberate: no deploy, and a notice quoting the real annotation (row 11), which fails safe but leaves #26's main case unfixed.
- Disposition: **defer**: settled by the first real group cancellation; see A6.

**F10 (low) — 2.17: every scheduled `catch-up` creates a GitHub deployment to `production`, 48 a day.** `environment: production` on `catch-up` (`ci.yml`) creates a deployment per run; `deployment: false` would avoid it but was not added "per the user's instruction" (2.17 plan, Implementation Notes and Residual risks). README documents the noise.
- Disposition: **defer** to the user: a workflow change touching the deploy jobs, which the epic's Notes reserve to the user's decision.

**F11 — 2.1's spine Deferred line** is folded into F1.

### Process lessons

**P1 (medium) — The previous retro's A8 landed only as an orchestrator workaround: review depth still follows the route, not the risk.** `.claude/skills/bmad-build-auto/customize.toml:68` still pins `review = "quick"`. High-risk 2.1 and medium 2.2 were first reviewed with the quick lens only (ledger, 2.1 and 2.2 entries; plans' first Review pass). The orchestrator then ran thorough follow-up passes on 2.1, 2.2 and 2.7 and rendered later medium/high tickets with `--set workflow.review=auto` (ledger DECISION, 2026-11-25; briefs). `auto` maps `oneshot` to quick, so medium-risk 2.16 (#27) and 2.17 (#64), both changing `ci.yml` and the deploy jobs' secrets, got one quick lens and no follow-up (plans: `route: oneshot`, `risk: medium`, `review: quick`). The thorough follow-ups paid for themselves: 2.1's found 4 medium (12 patched), 2.2's 8 patched groups, 2.15's a real high. 2.17's quick lens itself found a medium (README step 4 could undo a live rollback), which suggests a second lens would have been worth running there too.
- Disposition: **defer** (process, user/orchestrator). Lesson: select review depth from ticket risk (medium and high get thorough) independently of route.

**P2 (low) — Two merges left `tickets.toml` order, each for a recorded reason, with no defect.** 2.5 merged before 2.12 because 2.12 was held for its Firefox follow-up and 2.5's merge was the way to deploy 2.11's orphaned `ea86627` (ledger); 2.9 merged ahead of the 2.15–2.17 lane because it needs only 2.8 and touches no workflow (ledger; 2.9's review rejected the measured-commit concern as false, 2.9 plan Review Triage Log). Every main run after them is green (`gh run list`).
- Disposition: **accept**.

**P3 (low) — A GitHub incident dropped the push event for merge `ea86627` (PR #56, 2.11): no main run exists for it.** Confirmed by `gh run list --branch main` (no run between `dacc657`'s 45644264929 and `0b883a5`'s 45656662261). It was fixed forward: 2.5 was rebased on top, tested on the branch (45655894429) and merged, and its main run deployed both (ledger DECISION). This case became row "No run" of 2.15's catch-up (2.15 plan, matrix; security report, Backlog decisions on #26).
- Disposition: **accept**; the systemic fix is 2.15, still unobserved (P6).

**P4 (low) — A flaky e2e drop test failed a main run.** Main run 45677224517 (2.6's merge `98b0f86`), attempt 1, failed in `test` on `[phone] edit.spec.ts:237`: the drop landed mid-text where a long description wraps at phone width; the same tree passed on the branch. Deploy was skipped and production stayed on `22d8b84`; attempt 2 passed (`gh run view`: attempt 2, success). Bug 2.14 (#60, `e7cfdb8`) made `dropText` self-checking. 2.14's review left one coverage gap: the add-field drop test does not wrap (2.14 plan, rejected low).
- Disposition: **accept**; fixed. Lesson: a test that computes a screen position from text should assert its own precondition (2.14 did this).

**P5 (medium) — 2.15 (#26) reached review before its decision matrix was settled, then needed two follow-up passes.** The first build halted at review on an intent gap (`[skip ci]` tips; deliberate versus group cancellations), which needed a po Decision (`009bbf0`) and a re-plan from a saved patch (2.15 plan, First Attempt Result). The re-run's thorough review recommended a follow-up; that follow-up found and patched a real high (a scheduled deploy queued in `deploy-prod` could replace a pending rollback, or undo one in an A→B→A sequence) by adding `catch-up-gate`, and again recommended a follow-up (2.15 plan, Auto Run Result, Follow-up pass). The orchestrator stopped at one follow-up pass and relied on verifying on `main` (ledger DECISION). So `catch-up-gate`, the fix for the high, has had no review independent of the pass that wrote it, apart from this retrospective's diff review below.
- Disposition: **accept** the instance (this retro's CI review covers the gate); lesson **defer** to the process: a high-risk ticket that depends on a platform's semantics (GitHub concurrency groups, skip tokens, cancellation) should have its decision matrix settled at refine, and a high patched in the last allowed pass should get one fresh review before merge.

**P6 (medium, open) — 2.15's scheduled catch-up has not yet been observed firing on `main`.** `ci.yml:22-23` schedules `17,47 * * * *`. Since `c32ae8d` merged at 23:38Z, the 23:47Z and 00:17Z slots have passed, and `gh run list --event schedule` returns nothing as of 00:24Z on 2026-11-26. GitHub often delays or skips the first runs of a new schedule, so this is not yet evidence of a defect, but #26's acceptance criterion 3 ("a scheduled run finds production on main's code … `catch-up` shows a notice") is unproven, and the 2.17 environment change has never run on the schedule path either.
- Disposition: **defer**: keep #26 open until a scheduled run is seen (A5).

**P7 (low) — The previous retro's A9 (record a strict-mode pitfall in the project's agent instructions) did not land.** `AGENTS.md` (6 lines) has only the Git section. The lesson was applied in code instead (2.1's `announcement()` fix), and no strict-mode failure recurred in this epic's plans.
- Disposition: **defer** to the user (via `bmad-project-context`), low.

### Diff-scope review

Two `bmad-review` passes ran headless, each with the adversarial, edge-case-hunter and verification-gap lenses as separate sub-agents, over `git diff e8b4cad b167cfe`: one over `apps/web`, `apps/api`, `packages/contract/src`, `e2e/` and `apps/web/test` (12,211 diff lines), one over `.github/workflows/ci.yml`, `scripts/deploy-catch-up*`, `scripts/ci-workflow-steps.test.ts`, `README.md` and `apps/web/nginx.conf` (2,330 lines). The weight was on ticket boundaries. Their findings are unverified reports; the parent re-read the code behind each one kept below (line numbers at `b167cfe`), and dropped those it could not tie to a line. CSS and the quality reports' prose were not reviewed by a lens.

**Web and API: mutations crossed on one todo (2.1 × 2.3, 2.4, 2.5).** Each story tested its own action alone or behind a create; no test in `apps/web/src/todos/mutations.test.ts` queues a delete beside an edit or completion of the same id (verification-gap lens; `DeleteConfirm.component.test.tsx:135-148` toggles while the confirm is open but never confirms). Verified in code:

- **R1 (medium) — An edit typed on a card whose create is still pending is lost without a word when the create fails.** The follow-up is `dropped` (`mutations.ts:191-195`, `chain.createFailed`); `TodoCard.save()` returns on anything but `failed` (`TodoCard.tsx:228-231`); `AddForm` restores the original text, not the edited one (`AddForm.tsx:51-59`). The epic's Outcome is "it never loses their work"; this path loses the edit. It needs a stalled or failing create plus a quick edit, so it is rare. **Fix now.**
- **R2 (low) — A card deleted while its create is pending comes back as text in the add field when the create fails.** The delete is `dropped` for the same reason, and `AddForm` restores and offers the id for reuse regardless (`AddForm.tsx:51-59`), so "Couldn't add “x”" is announced for a todo the user removed on purpose. **Fix now**, with R1: both are the add form not knowing what its follow-ups did.
- **R3 (low) — Failure leads can contradict the list when a delete is queued behind the failing call, or after a 404.** `revert` re-applies a queued delete (`apply: () => null`, `mutations.ts:157-174`, `:291-296`), so an edit failure says "… is back as it was" while the row stays gone, then "Deleted" follows; a follow-up's 404 sets no chain flag (`:202-205`), so a queued delete's 404 counts as success and announces "Deleted" right after "was deleted elsewhere". A toggle undone at once with both PATCHes failing names the wrong verb, since `setCompleted` captures `completed` at click time while `editDescription` reads the cache after the revert (`:262-279`). The final list state is right in every case; only the announcements are. **Defer.**
- **R4 (low) — A failed delete puts the row back at the index captured when it was applied** (`mutations.ts:145`, `:166`, `:173`), so adds or deletes during the flight put it in a stale slot until the settle refetch. **Defer**, with R3.

**Web and API: other findings.**

- **R5 (accept) — After a 10 s nginx 503 or the 15 s client abort, the failure lead states an outcome the server may not have.** This is the spine's accepted Deferred behaviour for a write that may have landed (`architecture-todo-app.md:399`): revert, announce, and let the refetch show the truth. Recorded so later retros stop re-flagging it; F1's spine update should restate it for follow-ups as well as creates.
- **R6 (low) — `Intl.Segmenter` is built when `messages.ts` loads, unguarded** (`messages.ts:7`), and the web build sets no `build.target` or browserslist, so a browser without it (Firefox before 125) would fail at startup. Every current Chromium, Safari and Firefox release has it, and the test strategy covers Chromium only. **Accept**, low; written down so a support floor, if one is ever set, includes it.
- **R7 (low) — The e2e `quoteText` helper still cuts by code point** (`e2e/helpers.ts:175-179`, copied in `e2e/a11y/keyboard-pass.mjs:62-66`), while 2.10 made `quote()` cut on whole characters; harmless while e2e text is ASCII. The whole-character cut is unit-tested for added, deleted, deleted-elsewhere and complete failure only (`messages.test.ts`), not for the edit, reopen, delete or add leads. **Defer.**
- **R8 (low) — The 15 s write abort is tested on POST and DELETE but not PATCH** (`client.test.ts:160-236`). The timer is one branch for every non-GET method (`client.ts:133-137`), so the risk is a later narrowing. **Defer**, with R7.
- **R9 (accept) — GET has no client timeout** (`client.ts:133`): by AD-11 the list fetch is cancellable and nginx bounds it at 10 s; only an unresponsive nginx leaves the skeletons up until the edge gives up. Accepted design.
- **R10 (accept) — nginx maps only its own 400 and 413 under `/api/` to the problem response** (`nginx.conf:29`, `:66`); 414 and 494 stay HTML. Already listed as accepted in AD-4 and security report S9.
- Checked and sound: every add, edit, complete and delete goes through the helper's `run()` and so gets the write abort; add and edit share `TextField` with no per-form switch, and the IME and drop fixes are tested on the edit path (`e2e/edit.spec.ts:180`, `:230`); every announcement goes through `quote()`; the Empty panel waits for a leaving row (`ListStates.component.test.tsx:298`).

**CI and deploy (2.15 × 2.16 × 2.17 × 2.18).** Read-only `gh` checks by the reviewer: run 45727428285 ran `test` and `deploy` and skipped `dispatch-off-main`, `catch-up` and `catch-up-gate`, as a push should; the `production` environment exists with no branch policy, no protection rules and no secrets, and the five deploy secrets are still repository secrets; `catch-up-gate` uses only `github.token`, so 2.18's move breaks no job.

- **D1 (medium) — README states the secrets already live in `production` and that it is limited to `main`; neither is true until 2.18.** `README.md:151-160`, table and opening paragraph, written by 2.17 in the present tense. A reader would believe S10 closed. **Fix now** (docs).
- **D2 (medium) — README says a scheduled deploy "never" replaces or undoes a rollback** (`README.md:137`, `:190`). 2.15's own plan keeps a window of seconds between the gate's API read and `deploy` joining `deploy-prod` (2.15 plan, Follow-up pass, Residual risks), and D3 below is a second way. **Fix now** (docs), with D1.
- **D3 (medium) — Re-running a failed scheduled run is unsafe in two ways.** (a) The guard (`ci.yml:291-303`): after "Start production" deployed tip T and the health check failed, a re-run still carries `CHECKED` = the old SHA from attempt 1, so `deployed (T) != CHECKED` takes the `elif` and sets `skip=true`; the job goes green with no health check. (b) The gate's `since` is the current attempt's start (`deploy-catch-up.mjs:469-476`), so a rollback that finished between attempts is not seen, while `catch-up`'s outputs come from attempt 1. Both need a person to press re-run on a scheduled run. **Defer** to the user: the fix touches the deploy job's steps, which the epic's Notes reserve to the user (Decision 2026-11-25, po).
- **D4 (medium) — Nothing pins the gate's wiring.** The job-graph test evaluates `needs.catch-up-gate.outputs.clear` (`ci-workflow-steps.test.ts:277-306`), but no test checks the step `id: gate`, the job output mapping from `steps.gate.outputs.clear`, or the `gate` argument (`ci.yml:196-197`, `:207-211`); grep finds none of them in either test file. A rename there silently stops every scheduled deploy, which is the failure #26 exists to prevent. **Fix now** (test only; no workflow change).
- **D5 = F9 (medium, unverified) — the group-cancellation wording.** The reviewer found one cancelled run on the repo, 45725687701, whose `deploy` check run has no annotations; it is a push on the throwaway branch `verify-27-dispatch-off-main` (`gh run view`), not a group cancellation, so it neither confirms nor refutes the match. Every test uses the author's string (`deploy-catch-up.test.ts:77-78`). F9's disposition stands.
- **D6 (low) — During a long SSH outage, failed scheduled runs pile up for one tip** (about 48 a day), and the next decision fetches jobs for each until it reaches an attempted run (`deploy-catch-up.mjs:295-357`); past 10 pages it fails closed. **Defer**, with D3.
- **D7 (low) — A rollback by hand can name a SHA that is not on `main`** (`ci.yml:235-246`: only `github.ref` is checked, and `fetch-depth: 0` resolves any commit). Pre-existing AD-18 rollback design from epic 1. **Defer**, with D3, as a question for the user.
- **D8 = F10 (low)**, plus: if 2.18 or later adds required reviewers or a wait timer to `production`, every half-hourly `catch-up` will wait for approval, and the Deployments view shows main's tip as active even when nothing deployed. Carried to Open questions.
- **D9 (accept) — A skip token in a code commit's message makes the catch-up treat it as needing no deploy** (`deploy-catch-up.mjs:71-73`); AGENTS.md allows `[skip ci]` only on `_bmad-output/`-only commits, and the po Decision (`009bbf0`) chose message-only detection. Such a push gets no CI run anyway. Accepted by decision.
- **D10 (accept) — `catch-up` loads the full deploy key to run `docker ps`.** Rejected in 2.15's triage: a restricted key needs a new secret and a host change.
- Checked and sound: nginx's 400/413 mapping is pinned by contract and profile tests (`todos.contract.test.ts:177-209`, `headers.profile.test.ts:91`); `dispatch-off-main` is pinned by running its step (`ci-workflow-steps.test.ts:349-375`) and by real run 45725697794.

## Behavior verification

Not exercised by this retrospective: the run's rules forbid docker/compose and production, and the local test stack needs compose. What the evidence shows instead:

- **CI:** every merge of this epic has a green main run with test, deploy and the public health check, except `ea86627`, which has no run (P3) and was deployed by `0b883a5`'s run, and 2.6's, which passed on its second attempt (P4). The e2e suite covers E1–E8 in the desktop, phone and desktop-dark projects with an axe scan in every test (coverage report, scenario table).
- **Production, by the orchestrator (ledger):** API smokes after 2.3 (create, complete, reopen, delete), 2.4 (edit trimmed `200`, blank `400`) and 2.5 (delete `204`, page `200`); edge checks after 2.8 (F6); 2.16's dispatch from a throwaway branch failed loudly in `dispatch-off-main` (run 45725697794); 2.17's main run deployed in environment `production` with health OK.
- **Not seen anywhere:** the scheduled catch-up path (P6), a real group cancellation (F9), the UI journeys on production, and a real screen reader (F5).

## Previous-retro follow-through

From `epic-todo-foundation-retrospective.md`, Action items:

| Item (owner) | Landed? | Evidence |
|---|---|---|
| A1: axe scan in every e2e test; correct the report (dev) | yes | `02bfa36` "Scan every e2e test with axe and fail test:all on a test without a scan"; `e2e/validation.spec.ts` and `e2e/motion.spec.ts` now call `expectNoAxeViolations` |
| A2: amend AD-18's token and AD-20's layers (architect, via user) | yes | `a7e2940` "Amend AD-18's deploy token and AD-20's test layers"; `architecture-todo-app.md:213-215`, `:236-242` |
| A3: make the mutation helper safe before epic 2 builds on it (po, then dev) | yes | story 2.1 (#42), `b9ae5e9` |
| A4: header tests on assets, 404 and 503 (dev) | yes | backlog #24, `9e1c1b2` |
| A5: docs and config accuracy (dev) | yes | backlog #25, `d39a564`; #34, `9190105` |
| A6: rejected-but-real findings into the backlog (po) | yes | #26–#31 and #33 became tickets; #26, #27, #29, #30, #31 and #33 were moved into this epic and built or run (2.10–2.16), and #28 was fixed by 2.8 (`16cdf23`) |
| A7: shared e2e helpers before epic 2 adds specs (dev) | yes | `e2e/helpers.ts`, added by 2.1 (`3551c37`) and used by every spec; residual duplication in F2 |
| A8: review depth follows risk (user / orchestrator) | partly | orchestrator `--set` override and follow-up passes; `customize.toml:68` still `review = "quick"`; P1 |
| A9: strict-mode pitfall in agent instructions (user) | no evidence found | `AGENTS.md` has no pitfall entry; P7 |
| A10: close epic-todo-foundation on the board (po) | yes | `epic-todo-foundation.md:13` `status: done`; `tickets.py status` shows the epic done |

## Action items

All proposed, none applied. Each is either **(a)** an in-scope fix to do now on a fix branch through the normal build loop (`bmad-build`, a branch off `main`, PR), or **(b)** deferred to the backlog or to the user, with a proposed ticket. Spec changes go through `bmad-agent-po` or `bmad-architecture`; settings and secrets stay with the user.

| # | Action | Kind | Route | Owner | From |
|---|---|---|---|---|---|
| A1 | Keep the user's edit and deleted state when a pending create fails: a follow-up `dropped` behind a failed create must not silently lose an edited text (restore the latest edited text, not the original, into the add field, or keep it as the card's draft), and a todo deleted while its create was pending must not come back into the add field. Add unit tests that queue an edit and a delete behind a failing create, and a delete beside a failing edit and a failing completion on one id. | remediation (web: `mutations.ts`, `AddForm.tsx`, `TodoCard.tsx`) | (a) | dev | R1, R2, verification-gap on crossed kinds |
| A2 | Pin `catch-up-gate`'s wiring in `scripts/ci-workflow-steps.test.ts`: the step `id: gate`, the job output `clear: ${{ steps.gate.outputs.clear }}`, and `node scripts/deploy-catch-up.mjs gate`; spawn the CLI's `gate` mode once against the local HTTP server the CLI test already uses. Test only, no workflow change. | remediation (test) | (a) | dev | D4 |
| A3 | README accuracy: say the five secrets *move* to `production` with #65 and are repository secrets until then (S10 still open); replace "never" about a scheduled deploy and rollbacks with what holds (a seconds-wide window remains, and a scheduled run must not be re-run by hand: wait for the next schedule). Record in security report S2 and S3 the orchestrator's production edge checks of 2026-11-25 (`http` → `301`; oversized `POST` → validation problem; `%zz` → Cloudflare HTML `400`, S9). | remediation (docs) | (a) | dev | D1, D2, F6 |
| A4 | Extend I6 (`apps/api/test/profile/restart.profile.test.ts`) to edit and complete one todo and delete another before the API restart, and assert both after it. | remediation (test) | (a) | dev | F4 |
| A5 | Keep #26 open until a scheduled run of `ci.yml` is seen on `main` with its "Deploy catch-up" notice (its AC3), and check that `catch-up` ran in environment `production`. If no scheduled run appears within a few hours of slots, investigate the schedule (default branch, workflow state). | process (observe) | (b) existing #26; no new ticket | orchestrator | P6 |
| A6 | When the first real `deploy-prod` group cancellation happens, read its annotation (row 11's notice quotes it) and confirm or correct `GROUP_CANCELLATION` in `scripts/deploy-catch-up.mjs`. | verification | (b) | orchestrator / dev | F9, D5 |
| A7 | Make a re-run of a scheduled deploy safe (guard's `elif` also requires `deployed != SHA`; the gate reads the first attempt's start), and decide whether a rollback by hand must name a SHA on `main` and how catch-up behaves after a long SSH outage. Proposed to the user: it changes the deploy job's steps. | remediation (workflow), user decision | (b) | user, then dev | D3, D6, D7 |
| A8 | Reconcile the spine with the as-built: AD-18 gains the schedule, `catch-up`, `catch-up-gate`, `dispatch-off-main` and environment `production`; the Deferred line on a write that may have landed records 2.1's id reuse (and the follow-up case, R5); AD-4/AD-13 record nginx's 10 s `proxy_read_timeout` and the client's 15 s write abort. Through `bmad-architecture`, with the user's consent. | spec reconciliation | (b) | architect (via user) | F1 (2.1's deferred item) |
| A9 | Share the e2e failure matrix (`[503 problem, no response]`) and the "hold the PATCH" setup in `e2e/helpers.ts`, and use them in the five specs; make `quoteText` (and its copy in `keyboard-pass.mjs`) call the same whole-character rule as `quote()`. | remediation (tests) | (b) | dev | F2 (2.7's deferred item), R7 |
| A10 | Make failure announcements match the list when calls on one todo are mixed: a lead that does not say "back" when a queued delete keeps the row gone; no "Deleted" after "deleted elsewhere"; the toggle lead read after the revert; a reverted delete re-inserted relative to its neighbours, not at a stale index. Add the PATCH case to the write-timeout test and whole-character cases for every lead. | remediation (web) | (b) | dev | R3, R4, R7, R8 |
| A11 | The user's own screen-reader check of Flow 2 (TalkBack or a desktop reader), including how the field's description parts are voiced (accessibility report A3, A4); any failure becomes a bug. | verification (hitl) | (b) | user | F5 |
| A12 | Verify a multi-line drop keeps one undo step in Firefox (and Safari), in the add and edit fields; a failure becomes a bug. | verification (manual) | (b) | user or dev with a Firefox-capable host | F8 (2.12's deferred item) |
| A13 | Decide whether `catch-up` takes `deployment: false` (no deployment per half-hourly check); the 2.17 build left it out on the user's instruction. | user decision | (b) | user | F10, D8 (2.17's noted noise) |
| A14 | Let review depth follow ticket risk, not route: medium and high tickets get the thorough lenses even on the oneshot route (a `customize.toml` change or an orchestrator rule), and a high patched in the last allowed pass gets one fresh review before merge. | process | (b) | user / orchestrator | P1, P5 (previous retro A8) |
| A15 | Settle a high-risk ticket's decision matrix at refine when it rests on platform semantics (GitHub concurrency, skip tokens, cancellations), as 2.15's halt showed. | process | (b) | po | P5 |
| A16 | Record the strict-mode pitfall (text in a visible element and a frame-delayed live region) in the project's agent instructions. | process | (b) | user (via `bmad-project-context`) | P7 (previous retro A9) |
| A17 | Do #65 (2.18): move the five secrets into `production`, limit it to `main`, delete the repository secrets, and redeploy the live SHA. Add no required reviewers or wait timer to `production` unless `catch-up` stops naming it (D8). | human | (b) existing #65; no new ticket | user | pending ticket, D1, D8 |

Proposed backlog tickets for the (b) items without one:

- **A6** — "Confirm the deploy-prod group-cancellation annotation the catch-up matches": on the first real group cancel, compare its annotation with `GROUP_CANCELLATION` and fix the pattern if it differs.
- **A7** — "A re-run scheduled deploy can skip its health check or miss a rollback": harden the guard and gate for re-runs, and decide on rollback SHAs off `main` and catch-up after long SSH outages (touches deploy steps; user decides).
- **A8** — "The architecture spine describes the scheduled catch-up, the production environment and the write timeouts": amend AD-18, AD-4/AD-13 and the Deferred line to match 2.1 and 2.15–2.17.
- **A9** — "The e2e specs share one failure matrix and held-request helper": move the five copied failure arrays and two held-PATCH blocks into `e2e/helpers.ts`, and cut `quoteText` on whole characters.
- **A10** — "Failure announcements match the list when edits, completions and deletes of one todo overlap": fix the leads and the restore index for mixed queued calls, with tests.
- **A11** — "The user checks Flow 2 with a real screen reader" (hitl): run the pass the accessibility report leaves pending and file any failure.
- **A12** — "A multi-line drop keeps one undo step in Firefox": verify the 2.12 fallback outside Chromium and file any failure.
- **A13** — "Decide whether the scheduled catch-up creates a deployment each run": choose `deployment: false` on `catch-up` or keep the noise.
- **A14** — "Build review depth follows ticket risk": thorough lenses for medium and high tickets regardless of route, and a fresh pass after a late high.
- **A15** — "Refine settles platform-dependent decision matrices before build": a refine checklist item for high-risk CI and platform tickets.
- **A16** — "Record the live-region strict-mode pitfall for agents": add it through `bmad-project-context`.

## Decision records

Proposed only: this headless run writes no record. No `adr-*.md` file or decisions folder exists in the repository, so each would go in `docs/decisions/`. None is recorded in the spine today; if A8's amendment records one in full, that record is no longer needed.

| Proposed record | Plan | Commit | Approved / written |
|---|---|---|---|
| `adr-an-unchanged-resubmit-reuses-the-failed-add-id.md`: a failed add resubmitted with its restored text unchanged keeps its id, so AD-6's idempotent replay stores one todo even if the first request landed; changed text mints a new id. Why: the previous retro's A3 and the user's Decision of 2026-11-25 (epic Notes); trade-off in the plan's Design Notes, first bullet. | 2.1 plan, Design Notes | `3551c37` (merge `b9ae5e9`) | not approved (headless), not written |
| `adr-writes-give-up-at-10-s-in-nginx-and-15-s-in-the-client.md`: nginx's `proxy_read_timeout` for `/api` is 10 s and becomes AD-4's 503; the client aborts any write after 15 s as `network`, a backstop for when nginx itself does not answer; reads have no client timeout. Why: 2.1 plan, Design Notes, third bullet; epic Notes, Decision 2026-11-25 (po). | 2.1 plan, Design Notes | `3551c37` (merge `b9ae5e9`) | not approved (headless), not written |
| `adr-the-scheduled-catch-up-deploys-only-a-group-cancelled-or-unrun-tip.md`: a half-hourly `catch-up` deploys main's tip only when its deploy was cancelled by the `deploy-prod` group or its push produced no run; `[skip ci]` tips need no deploy; any other cancellation is deliberate; no kill switch; a `catch-up-gate` skips the deploy if a rollback by hand is unfinished or started during the run; it fails closed. Why: the po Decision settling the intent gap (`009bbf0`) and the follow-up review's high (2.15 plan, Plan Change Log and Review Triage Log). | 2.15 plan, Intent, Design Notes, Implementation Notes | merge `c32ae8d` | not approved (headless), not written |

Considered and not proposed: nginx answering its own 400/413 under `/api/` through a reserved path (already in AD-4, amended in `2fec682`); 2.12's guarded drop intercept (local to `TextField.tsx` and easy to reverse); 2.17's `environment: production` (recorded in README and security report S10).

## Acceptance verdict

**Machine verdict: rejected**, because one of this epic's tickets is unfinished: **2.18 (#65)**, the user's move of the deploy secrets into `production`, `state: backlog`. The rule makes an unfinished ticket force **rejected** in headless runs too; this run cannot apply a human override.

Criteria: **declared** (the epic file's Requirements R4–R14, R17–R20 and Done when). Against them, on the evidence:

- **Met:** edit, complete, reactivate and delete with an inline confirm and no undo, each shown at once and reverted with a message on failure (R4, R5, R7, R13; E2–E4, E6 in three projects; production API smokes in the ledger); an invalid edit refused (I4, I11, K3; production smoke `400`); a failed add resubmitted unchanged stores one todo and a stalled save ends in about 10 s (2.1; `stalled-api.profile.test.ts`); completed todos distinct and receding in light and dark (R6; `complete.spec.ts` colour and layer checks); empty, loading and error states (R9; K5, E5, E6 list part); axe with no AA violation in every e2e test and Lighthouse 100 in both modes (R14, accessibility report); whole-app coverage, performance (every action painted within 53.1 ms, API p95 at most 0.8 ms) and security reports, every finding fixed or accepted (R18–R20); everything deployed by CI (every merge's main run green, `ea86627` deployed by `0b883a5`'s).
- **Met with recorded deviations:** the screen-reader half of the manual pass is the user's pending optional check (F5; epic Notes, Decision 2026-11-25); persistence across a server restart is proved for a created todo and inferred for edits, completion and deletes (F4); UI journeys ran on `todo-test`, production by API (F7).
- **Open findings, none blocking on its own:** R1 (an edit lost when a pending create fails, against the Outcome "never loses their work", in a rare stalled-save path), D1/D2 (README overstates S10 and the rollback guarantee), D3 (re-running a scheduled run), D4 (gate wiring unpinned), P6 (the scheduled catch-up not yet observed), F9 (unverified annotation match).

**If a human applies the recorded decisions** — the user's Decision of 2026-11-25 in 2.18's Notes, "The epic's closure does not wait on it", and the epic's po Decision that entry 18 "does not hold the epic's closure" — the verdict on the criteria is **accepted-with-open-items**, the open items being A1–A4 (fix now), #26's observation (A5), #65 (A17) and the deferred list. That override is the user's to make; it is not applied here.

## Open questions

- Does the user confirm the override to **accepted-with-open-items** on the strength of their 2.18 Decision, and should A1–A4 land before issue #3 is closed or after?
- Will the first scheduled run fire? None has by 00:30Z on 2026-11-26 (slots 23:47Z and 00:17Z passed; workflow `active`, per the CI reviewer). A failure to fire for several more slots would make #26 unfixed in practice.
- For #65: will `production` get required reviewers or a wait timer? If so, `catch-up` must stop naming the environment (or the schedule waits for approval every half hour) (D8).
- R1's fix choice: should an edit that was dropped behind a failed create come back in the add field (as the latest text) or be announced as lost? EXPERIENCE does not cover a follow-up dropped behind a failed add; a UX answer would change A1's shape.
- Is there a browser support floor? Setting one decides R6 (`Intl.Segmenter`) and A12 (Firefox undo).

## Assumptions

- **Epic resolution:** `-H epic-manage-todos` matched `epics[1]` (slug `epic-manage-todos`, id 2) in `tickets.py status`; folder `_bmad-output/initiative-todo-app/tickets/epic-manage-todos/`.
- **Unfinished tickets:** `pending_tickets` was derived from the `status <folder>` rows (the script's output carries no `pending_tickets` key): `2.18` only. Headless, no one confirmed retro-ing over it; the run proceeded and recorded it. `2.15` is finished by the definition (`status: built`) though its tracker state is in-progress. `2.13` is finished (`state: done`, no build status, a spike).
- **Machine verdict:** **rejected**, forced by `2.18`, with no human decision in this run.
- **Ranges:** 2.15's `baseline_revision` (`562a8c5`) is off `main`; its merge-base `32c3365` was used. The last range was cut at `b167cfe`, excluding the bookkeeping commit `118d8f4`.
- **Evidence weight:** the orchestrator's ledger was read as evidence (run ids, merges, decisions), and its run claims were spot-checked with `gh run list` and `gh run view` (all main runs present and green, attempt 2 of 45677224517, no run for `ea86627`, no scheduled run). The orchestrator's points to weigh were each checked against plans, code or runs before becoming findings; all of them held.
- **Diff-scope review:** delegated to two sub-agents, each running `bmad-review` with three lenses; their findings were re-checked by the parent at the cited lines before routing, and several were dropped as speculative. CSS and the reports' prose were not reviewed by a lens.
- **Behavior check:** not run here (no docker/compose, no production per the run's rules); the Behavior verification section rests on CI runs and the ledger's production smokes.
- **Session logs:** not available; process lessons rest on the ledger, briefs and plan logs.
- **Action items, decision records and their routing** ((a) fix now on a fix branch, (b) backlog or user) are proposals; nothing was applied, no ticket was created, and no status was changed.
- **Scheduled-run observation** is as of 00:30Z on 2026-11-26.

## Action items filed

Filed 2026-11-26 by the po (hands-off run on the user's instruction). (a) items are entries in this epic, parent #3; (b) items are backlog tickets with no parent, or lines on an existing ticket.

A1 → 2.19 #70 (bug, medium); A2 → 2.20 #71 (story, low); A3 → 2.21 #72 (bug, low); A4 → 2.22 #73 (story, low); A5 → 2.15 #26, a Notes line, no new ticket; A6 → backlog/14 #74 (spike, medium); A7 → backlog/15 #75 (bug, high, user decides; blocked by #71, #72); A8 → backlog/16 #76 (story, medium, user decides); A9 → backlog/17 #77 (story, low); A10 → backlog/18 #78 (bug, low; blocked by #70); A11 → backlog/19 #79 (spike, medium, hitl); A12 → backlog/20 #80 (spike, low, hitl); A13 → backlog/21 #81 (story, low, user decides); A14 → backlog/22 #82 (story, medium); A15 → backlog/23 #83 (story, low); A16 → backlog/24 #84 (story, low); A17 → 2.18 #65, a Notes line, no new ticket.
