---
epic: epic-manage-todos
date: 2026-11-26
verdict: accepted-with-open-items
criteria: declared
headless: true
---

# Retrospective: epic-manage-todos

A user manages their whole list, instantly, on any device (issue #3). This is the second headless run of 2026-11-26, at the orchestrator's request. It is reconciled against `main` at `4d9ed88`, the last code at `1e6fbb5` (PR #88).

The first run, cut at `b167cfe`, rejected the epic only because entry 18 (#65) was open. Since then:

- #65 is done.
- The scheduled deploy catch-up (entry 15, #26) was removed and #26 was dropped.
- Entry 19 (#70) was built.
- The first run's action items were filed, dropped or done, as the user's "check, simplify and close" Decision of 2026-11-26 says (epic Notes, last four lines).

Where the first run's findings still hold, they are kept here in short form, with their ids. The first run's full text is in git: `ce46db6`, this file.

## Epic summary

**Epic:** `_bmad-output/initiative-todo-app/tickets/epic-manage-todos/`. Resolved from the folder argument through `tickets.py status <folder>`.

**Tickets, in build order** (`tickets.py status <folder>`, 2026-11-26): 19 rows, 18 `done` and 1 `dropped`. **`pending_tickets` is empty.**

| Ref | Issue | status / state | PR, merge | Main run |
|---|---|---|---|---|
| 2.1 | #42 | built / done | #52, `b9ae5e9` | 45625204667 success |
| 2.2 | #43 | built / done | #53, `9ca01c0` | 45627303115 success |
| 2.10 | #33 | built / done | #51, `1d81bd5` | 45628714357 success |
| 2.3 | #44 | built / done | #54, `1c60711` | 45635759096 success |
| 2.4 | #45 | built / done | #55, `dacc657` | 45644264929 success |
| 2.11 | #30 | built / done | #56, `ea86627` | none (push event dropped, P3); deployed by `0b883a5`'s run |
| 2.12 | #29 | built / done | #58, `22d8b84` | 45658376289 success |
| 2.13 | #31 | (none) / done | spike, the user's phone run | n/a |
| 2.5 | #46 | built / done | #57, `0b883a5` | 45656662261 success |
| 2.6 | #47 | built / done | #59, `98b0f86` | 45677224517, attempt 2 success (P4) |
| 2.14 | #60 | built / done | #61, `e7cfdb8` | 45681048594 success |
| 2.7 | #48 | built / done | #62, `cc32daa` | 45689451484 success |
| 2.8 | #49 | built / done | #63, `16cdf23` | 45713067680 success |
| 2.15 | #26 | built / **dropped** | #67, `c32ae8d`; removed by #87, `acf8b5e` | 45722930978 success (push path); no scheduled run ever fired |
| 2.16 | #27 | built / done | #68, `eaf6281` | 45724922604 success |
| 2.17 | #64 | built / done | #69, `b167cfe` | 45727428285 success |
| 2.18 | #65 | (none) / done | hitl: the user moved the secrets | 45727428285 attempt 3: redeploy of `b167cfe` with environment secrets, health check ok |
| 2.9 | #50 | built / done | #66, `5b3d465` | 45721650865 success |
| 2.19 | #70 | built / done | #86, `d0884e2` | 45738427453 test and deploy success, health ok |

Run ids after `b167cfe` come from the tickets' dated Result lines, which the orchestrator verified. This run sent no request to GitHub.

Merges outside the ticket rows that belong to this epic's close:

- **PR #87 (`acf8b5e`):** removed the catch-up, under #26's user Decision.
- **PR #88 (`1e6fbb5`):** brought the four closing reports up to `d0884e2`. It is backlog #72, now `done`. Main run 45741129446 succeeded (#72's Result line).

The ticket rows have no `built` ticket left that is not also done or dropped. 2.13 and 2.18 are hitl and have no build status.

**Plan ranges.** The 12 ranges from `e8b4cad` to `b167cfe` are unchanged from the first run (`ce46db6`, Epic summary). One range is new:

| Range | Tickets | Notes |
|---|---|---|
| `7ffb26d..d0884e2` | 2.19 | 2.19's `baseline_revision` is `7ffb26d`. `git_evidence.py`: 6 commits, 2 merges, 2 measured. Also holds PR #87 (`f501818`, merge `acf8b5e`) |
| `b167cfe..1e6fbb5` | everything since the first run | 13 commits, 3 merges, 3 measured. Code and doc paths only: `ci.yml`, README, `scripts/` (−1,845 lines net from #87), `mutations.ts`, `AddForm.tsx` and their tests, `e2e/add-failure.spec.ts`, and four `docs/quality/` reports |

The cut is at `1e6fbb5`. `4d9ed88` after it is board bookkeeping.

**Evidence inventory.**

- **Read in full again:**
  - the epic file, including its 2026-11-26 Decisions
  - `tickets.py status` for the epic and for the backlog
  - 2.19's ticket and plan, with a thorough four-lens review: 24 findings, 6 patched, 1 deferred, 17 rejected
  - the Notes of 2.15 and 2.18
  - the backlog tickets #73, #76, #78 and #79
  - the commit messages and diffs of PR #87 (`f501818`) and PR #88 (`63b2445`)
  - README and `ci.yml` at HEAD
  - `git diff c32ae8d^1 HEAD` on `ci.yml`, README and `vitest.config.ts`
  - EXPERIENCE.md's two rows that #70 changed
  - the spine, checked for the AD-18, timeout and Deferred lines
- **Carried from the first run without re-reading:** the 16 earlier plans, the earlier quality-report bodies, the ledger and the briefs.
- **No run folders and no companions.**
- **Session logs:** not available. Process lessons rest on the plans and Notes.

## Findings

Each finding has a disposition (fix now, defer or accept) and, where the evidence gives one, a lesson for the next epic.

### First-run findings, reconciled

| Id | First-run finding (short) | Now | Evidence |
|---|---|---|---|
| R1, R2 | A pending add's edit is lost, or a deleted todo comes back, when the add fails | **fixed** | 2.19, PR #86 `d0884e2`: `mutations.ts` `latestAfter()` and `AddOutcome.latestDescription`; `AddForm.tsx` restores the latest text or nothing. Tests fail on the baseline (2.19 plan, Implementation Notes). The re-review confirmed it sound (below) |
| D1 | README said the secrets already live in `production` | **fixed** | #65 done (2.18 Result); README:142-151 is now true |
| D2 | README said a scheduled deploy "never" undoes a rollback | **moot** | the catch-up was removed (#87); no such claim remains |
| F6 | The security report's S2 and S3 did not record the edge checks | **fixed** | #72, PR #88 `63b2445`: S2, S3 and #28 record the 2026-11-25 checks; S10 is fixed |
| F9, F10, D3, D4, D5, D6, D8, P6 | Catch-up group-cancellation wording, a deployment on every scheduled run, re-run safety, unpinned gate wiring, outage pile-up, a reviewer gate stalling the schedule, a schedule never seen firing | **moot** | #87 removed the schedule, `catch-up`, `catch-up-gate` and `scripts/deploy-catch-up*`. `git grep` finds no leftover outside the history lines in `docs/quality/`. The deploy job's steps are byte-identical to before PR #67 (`git diff c32ae8d^1 HEAD -- ci.yml`: only the header comment, `dispatch-off-main`, `environment: production` and the actionlint step differ). #71, #74, #75 and #81 were dropped |
| P6 lesson | 2.15 rested on a platform feature never seen working | **accept** | GitHub fired no scheduled run in four slots (#26 Notes, user Decision 2026-11-26). Lesson: prove a platform trigger fires (a throwaway workflow on a branch, or the first slot after merge) before building logic on it. Folded into A3 |
| F1 | The spine is stale: AD-18, the Deferred line, the 10 s and 15 s timeouts | **defer**, tracked | backlog #76, trimmed to `dispatch-off-main` and `environment: production`. Still stale at HEAD: the spine has no "timeout" entry, and `:399` still says a resubmit mints a new id. See A1 for a Notes line |
| F2, R7 (helpers) | e2e failure matrix copied five times; `quoteText` cuts by code point | **defer**, tracked | backlog #77. PR #86 added a sixth local copy: `e2e/add-failure.spec.ts` now has its own `FAILURES` array (2.19 plan, Implementation Notes) |
| F4 | R11's restart persistence is tested for a created todo only | **defer**, tracked | backlog #73. A recorded deviation against the Done when (see Acceptance verdict) |
| F5 | The screen-reader half of R14 is pending | **defer**, tracked | spike #79. The accessibility report's pending line now names #79 (`63b2445`) |
| F8 | Firefox's one-step undo on a multi-line drop is unverified | **defer**, tracked | spike #80 |
| R3, R4, R7 (leads), R8 | Failure leads contradict the list when calls on one todo mix; a stale restore index; untested PATCH timeout and whole-character leads | **defer**, tracked | backlog #78, unblocked now that #70 is done |
| R5, R6, R9, R10, D9, D10, F3, F7, P2, P3, P4 | Accepted design or recorded deviations | **accept** (unchanged) | first run, `ce46db6`. D9 and D10 are moot with the catch-up gone |
| D7 | A rollback by hand can name a SHA that is not on `main` | **accept** | the AD-18 rollback design from epic 1. README Roll back step 2 tells the person to use "an earlier commit on `main`". It was carried in #75, which was dropped as moot, so it is recorded here |
| P1, P5 | Review depth follows the route, not the risk; a high patched in the last pass got no fresh review | **defer** as process lines | #82 and #83 were dropped as process-only, so these are A3 and A4 here. Mixed evidence since the first run: 2.19, medium on the `full` route, got the thorough lenses (plan `review: thorough`), but `.claude/skills/bmad-build-auto/customize.toml:68` still says `review = "quick"` |
| P7 | The previous retro's A9 (a strict-mode pitfall in the agent instructions) did not land | **defer**, tracked | backlog #84. `AGENTS.md` is still Git-only |

### New since the first run

The diff `b167cfe..1e6fbb5` got a `bmad-review` pass with the adversarial, edge-case and verification-gap lenses, run by one sub-agent. Its findings are unverified reports, so I re-read the code or text behind each one kept below, at `1e6fbb5`. The sub-agent also ran `vitest` on `scripts/ci-workflow-steps.test.ts`, `mutations.test.ts` and `AddForm.component.test.tsx`: 132 passed. It did not run e2e.

**N1 (medium): PR #87 removed the only tests of the deploy steps' own `if:` conditions.**

- `b167cfe:scripts/ci-workflow-steps.test.ts:327-346` had two tests:
  - "deploy step %s runs for %j": `Download` and `Push` run on push only, and `Start production` also runs on dispatch.
  - "the steps after the guard are skipped when it skips".
- The rewritten file tests the guard script, `dispatch-off-main`, the job graph, the environment and the secrets, but no step's `if:`. I checked with `grep`.
- Those tests came with PR #67: `c32ae8d^1`'s version has neither. So #87 returned this file's step coverage to its pre-#67 state, while the steps themselves are unchanged.
- **Scenario:** a later edit drops `steps.guard.outputs.skip != 'true'` from "Start production". An older run that reaches `deploy` late then overwrites a newer live SHA, and no test fails.
- **Disposition: defer.** It does not block closure: the code is as deployed and proven by main runs 45738427453 and 45741129446. It is A2, a line here, because the user wants no new ticket.
- **Lesson:** when a revert removes a feature, keep the tests that pinned pre-existing behaviour, even if the feature's PR added them.

**N2 (low): README's burst remedy does not cover a cancelled tip found after a day.**

- README:130 says to re-run the tip's `deploy` if it shows as cancelled.
- A deploy replaced while pending never pushed its images to GHCR, and the artifact lives one day (README:126, :134).
- After that day the re-run fails at "Download the tested images". The next paragraph's third bullet ("merge a new commit") is the fix, but :130 does not point to it.
- The first README's second case, a push with no run at all (P3), is also no longer named. Its remedy is the same: the next push deploys.
- **Disposition: defer**, a docs line (A2).

**N3 (low, accept): 2.19's deferred item.** A delete confirmed behind an add that fails with no response, but was stored after all, is never sent (U5), so the refetch shows the todo again, silently.

- The behaviour predates #70 (2.19 plan, frontmatter `deferred`; Design Notes, second bullet).
- Fixing it would mean sending a dropped follow-up, which AD-13 forbids.
- The user sees the todo and can delete it again.
- **Disposition: accept.** The spine and EXPERIENCE should say so. That goes with #76's AD-13 note (A1).

**N4 (low, accept): `scripts/` is never typechecked.** The root `tsconfig.json` includes only `vitest.config.ts`, and Vitest only transpiles, so `pnpm typecheck` misses type errors in `scripts/ci-workflow-steps.test.ts`. This predates #87 (since PR #67). Test-only. **Accept.**

**N5 (low, accept): a comment and a triage row in 2.19 are inaccurate, with no behaviour effect.**

- `mutations.ts:318` says the fallback means "a failure outside the send step".
- But `entry.latest` is set at `:249`, before `settle()`. So the fallback in practice runs only when a create's success `settle()` throws. That path predates #70.
- 2.19's triage row about the outer `.catch` rests on the wrong premise.
- **Accept.**

**N6 (low, accept): two delete tests assert a state that also held before the failure.** The e2e delete test in `add-failure.spec.ts` and the component delete test assert an empty field. They catch a wrong restore only because the form's restore runs before the refetch. **Accept**: the unit test pins `latestDescription: null` directly (2.19 plan, Implementation Notes).

**N7 (low, accept): the workflow test's `evaluate()` compares strings case-sensitively, unlike GitHub.** A branch named `Main` would be read differently. The `production` environment's branch rule still protects the secrets. This was not confirmed on GitHub. **Accept.**

**Checked and sound by the re-review:**

- `latestAfter` stops at a resubmitted create, as `revert` does, and guards a throwing `apply`.
- `run()` and the follow-up outcomes keep their shapes.
- U5's drop rule holds: no PATCH or DELETE is sent behind a failed create (unit, component and e2e tests).
- Story 2.1's id reuse applies only to the unchanged sent text.
- "Add landed after all" never clears an edited text (tested).
- `vitest.config.ts` still needs `scripts/**/*.test.ts`.
- `jobIds()` pins exactly three jobs.
- No README claim about the catch-up remains.

## Behavior verification

This run did not exercise the app: no Docker, compose or public host per the run's rules. The evidence:

- **CI.** Every merge since the first run has a green main run with test, deploy and the public health check, per the tickets' Result lines:
  - 45727428285 attempt 3: `b167cfe` with the environment secrets.
  - 45738427453: `d0884e2`, which includes #87's workflow.
  - 45741129446: `1e6fbb5`.
  - The `test` step in 45738427453 ran `test:all` with 129 e2e tests and 168 axe scans, 0 violations (accessibility report, Addendum 2026-11-26).
- **Production:** the secrets move and the redeploy (2.18 Result), and the 2026-11-25 edge checks (security report S2 and S3).
- **Not seen anywhere:**
  - a real screen reader (#79)
  - Firefox's undo (#80)
  - the UI journeys on production (F7, accepted)
  - a real `deploy-prod` group cancellation, now handled by hand per README:130 (N2)

## Previous-retro follow-through

From `epic-todo-foundation-retrospective.md`, Action items. These are unchanged from the first run, except A8 and A9:

| Item (owner) | Landed? | Evidence |
|---|---|---|
| A1: axe scan in every e2e test (dev) | yes | `02bfa36` |
| A2: amend AD-18's token and AD-20's layers (architect, via user) | yes | `a7e2940` |
| A3: make the mutation helper safe (po, then dev) | yes | 2.1, `b9ae5e9` |
| A4: header tests on assets, 404 and 503 (dev) | yes | #24, `9e1c1b2` |
| A5: docs and config accuracy (dev) | yes | #25 `d39a564`; #34 `9190105` |
| A6: rejected-but-real findings into the backlog (po) | yes | #26–#31 and #33 filed and settled: built, run, or #26 dropped |
| A7: shared e2e helpers (dev) | yes | `e2e/helpers.ts` (`3551c37`); the remaining duplication is #77 |
| A8: review depth follows risk (user / orchestrator) | partly | the orchestrator's override worked (2.19 `review: thorough`), but `customize.toml:68` still says `review = "quick"`; carried as A3 below |
| A9: strict-mode pitfall in the agent instructions (user) | no evidence found | `AGENTS.md` is Git-only; tracked as #84 |
| A10: close epic-todo-foundation (po) | yes | `tickets.py status`: epic 1 `done` |

## Action items

All are proposed, none applied. The user asked for no new tickets, so each item is a line here or a Notes line on a named existing ticket. Every other open item from the first run is already a backlog ticket: #73, #76, #77, #78, #79, #80 and #84 (see Findings).

| # | Action | Kind | Route | Owner | From |
|---|---|---|---|---|---|
| A1 | Add a Notes line to backlog **#76**: the spine amendment should also record 2.19's change to AD-13 ("a failed create's promise also carries the todo's text as its queued follow-ups left it, or null if one deleted it": 2.19 plan, Design Notes), and, in the Deferred line, the accepted case where a dropped delete reappears after an add that landed after all (N3) | spec reconciliation (Notes line) | existing #76 | po | 2.19 Design Notes, N3 |
| A2 | When `ci.yml` or README's Deploy section is next touched: restore the step-`if:` tests the catch-up PR brought (each deploy step's event table, and every step after the guard skipped when `skip=true`), and make README:130 say a cancelled tip re-run works within a day, after which the next merge deploys it (it also covers a push with no run). Test and docs only | remediation, opportunistic | line here, no ticket | dev | N1, N2 |
| A3 | Let review depth follow ticket risk, not route (medium and high get the thorough lenses), and give a high patched in the last allowed pass one fresh review. Before building on a platform trigger (a schedule, concurrency cancellation), first see it fire | process | line here (#82 dropped as process-only) | user / orchestrator | P1, P5, P6 lesson; previous retro A8 |
| A4 | Settle a high-risk ticket's decision matrix at refine when it rests on platform semantics | process | line here (#83 dropped as process-only) | po | P5 |
| A5 | When a feature is removed, keep or restore the tests that pinned the behaviour around it | process | line here | dev / reviewer | N1 |

**Status of the first run's action items:**

- **A1:** done as #70.
- **A2:** dropped as moot, #71.
- **A3:** done, folded into #72, PR #88, together with #65 and #87's README.
- **A4:** in the backlog as #73.
- **A5:** moot, #26 dropped.
- **A6, A7:** dropped, #74 and #75. D7 is accepted above.
- **A8:** #76, trimmed.
- **A9:** #77.
- **A10:** #78.
- **A11:** #79.
- **A12:** #80.
- **A13:** dropped, #81.
- **A14, A15:** now this run's A3 and A4.
- **A16:** #84.
- **A17:** #65, done.

## Decision records

Proposed only: this headless run writes none. No `adr-*.md` file or decisions folder exists, so each record would go in `docs/decisions/`. #76's Notes allow folding them into the spine amendment instead.

| Proposed record | Plan | Commit | Approved / written |
|---|---|---|---|
| `adr-an-unchanged-resubmit-reuses-the-failed-add-id.md`: a failed add resubmitted with unchanged text keeps its id, and changed text (including an edited text restored by #70) gets a new id. Why: epic Notes, Decision 2026-11-25 (user); 2.1 plan, Design Notes; 2.19 plan, AC4 | 2.1 plan; 2.19 plan | `3551c37` (merge `b9ae5e9`); `2f82758` (merge `d0884e2`) | not approved (headless), not written |
| `adr-writes-give-up-at-10-s-in-nginx-and-15-s-in-the-client.md`: nginx's `proxy_read_timeout` for `/api` is 10 s; the client aborts a write after 15 s as `network`; reads have no client timeout. Why: 2.1 plan, Design Notes; epic Notes, Decision 2026-11-25 (po) | 2.1 plan | `3551c37` | not approved (headless), not written |

Withdrawn since the first run: the scheduled catch-up record, because the catch-up was removed (#87).

Considered and not proposed: 2.19's `latestDescription`. It is local to `addTodo` and easy to reverse, and it is recorded as a spine note through A1.

## Acceptance verdict

**Machine verdict: accepted-with-open-items.** The criteria are **declared**: the epic file's Requirements R4–R14 and R17–R20, and its Done when.

- **Every ticket is finished.** `pending_tickets` is empty: 18 tickets `done`, and 2.15 (#26) `dropped` by the user's Decision of 2026-11-26.
- **No blocking finding is open.**

**Met:**

- Edit, complete, reactivate and delete, with an inline confirm and no undo, each shown at once and reverted with a message on failure (R4, R5, R7, R13).
- A failed add resubmitted unchanged stores one todo, and a stalled save gives up in time (2.1).
- A failed add no longer loses an edit made while it was pending (2.19 closes R1 and R2, against the Outcome "never loses their work").
- Completed styling in both modes (R6). Empty, loading and error states (R9). Phone and desktop (R8).
- 0 axe violations in every e2e test, through `d0884e2` (R14).
- The closing reports describe `main` at `d0884e2` (R18–R20):
  - whole-app coverage 95.9% of lines, which meets the 70% goal
  - security S10 fixed, and S2 and S3 edge results recorded
  - an accessibility and performance addendum
- Everything deployed by CI, with green main runs for every merge (`ea86627` was deployed by `0b883a5`'s run).

**Met with recorded deviations:**

- **The screen-reader half of the manual pass is pending.** The Done when asks for "a manual keyboard and screen-reader pass". R14 defines that pass "as Notes, decision 2026-11-25, says": an agent's keyboard and accessibility-tree pass, plus the user's own optional check, which does not hold closure. The check is spike #79.
- **Persistence across a server restart** is proved for a created todo and inferred for edits, completion and deletes (F4, backlog #73).
- **The UI journeys ran on `todo-test`;** production was exercised by API calls (F7).

**Open items, tracked or recorded, none blocking:**

- the backlog tickets #73, #76, #77, #78, #79, #80 and #84
- A1–A5 above
- the deviations under Findings, including N1 (deploy step `if:` conditions untested)

**Override of the first run.** It rejected only on #65, which is now done. Nothing in this run reverses a human decision.

## Open questions

- **Does the user want A2 (N1's step tests, N2's README line) done before #3 closes, or left for the next time `ci.yml` is touched?** Neither blocks the criteria; this run proposes leaving them.
- **Is there a browser support floor?** One would settle R6 (`Intl.Segmenter`) and spike #80.

## Assumptions

- **Epic resolution.** The argument was a folder: `_bmad-output/initiative-todo-app/tickets/epic-manage-todos`. `tickets.py status <folder>` returned 19 rows.
- **Unfinished tickets.** `pending_tickets` was derived from those rows, since the output has no such key. It is empty. 2.15 counts as finished (`state: dropped`), and 2.13 and 2.18 also count (`state: done`, hitl, no build status).
- **Machine verdict:** accepted-with-open-items, with no human decision in this run.
- **Resumed run.** The existing file was reconciled against current evidence and rewritten, simplified as the user asked. Findings that still hold keep their first-run ids. The first run's full findings, review detail and ranges remain in git at `ce46db6`.
- **Evidence weight.**
  - Run ids and outcomes after `b167cfe` come from the tickets' dated Result lines, which the orchestrator verified on 2026-11-26. This run made no `gh` or network call.
  - The earlier plans, ledger and report bodies were not re-read. Their findings stand as the first run recorded them, except where newer commits change them (the Reconciled table).
- **Diff-scope review.** One sub-agent ran `bmad-review` with three lenses over `b167cfe..1e6fbb5` (apps, e2e, scripts, `.github`, README, `vitest.config.ts`), one lens after another.
  - I re-checked each kept finding at the cited lines: N1 against `b167cfe` and `c32ae8d^1`, N2 against README, N4 against `tsconfig.json`, N5 against `mutations.ts:249` and `:318`.
  - N6 and N7 are kept as low and plausible, from the sub-agent's reading.
  - The quality-report prose was reviewed only for the claims cited here.
- **Behavior check:** not run (no Docker or public host).
- **Action items and decision records are proposals.** Nothing was applied, no ticket was created or edited, and no status changed.
