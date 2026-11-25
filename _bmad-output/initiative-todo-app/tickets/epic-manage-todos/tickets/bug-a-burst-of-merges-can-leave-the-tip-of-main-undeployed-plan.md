---
title: 'A burst of merges can leave the tip of main undeployed'
type: bugfix
ticket: '15'
created: '2026-11-25'
status: built
baseline_revision: '562a8c5548d4bec7d0032202c5725581313009c6'
route: full
route_source: auto
risk: high
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: [oversized]
deferred:
  - summary: >-
      The deploy-prod group's cancellation annotation text that row 10 matches has never been seen on this repo.
    evidence: |-
      No run of ci.yml on abuabdillahi/bmad-todo has been cancelled yet (gh api, 2026-11-25), so the regex
      `higher priority waiting request for '(deploy|***)-prod'` rests on GitHub's documented wording only.
      If the wording differs, a group cancel is read as deliberate: no deploy (safe), and the bug stays unfixed.
      Settled by the first real group cancel after merge: row 11's notice now quotes the annotation it found.
    location: >-
      scripts/deploy-catch-up.mjs (GROUP_CANCELLATION)
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** A tip of `main` whose deploy was cancelled in the `deploy-prod` group (a later-queued deploy of an older commit replaced it), or whose push produced no run at all, stays undeployed until the next push (R22, AD-18).

**Approach:** A `schedule` trigger (every 30 min) runs a new `catch-up` job that reads the SHA production runs over SSH, exactly as the deploy guard does, and asks a tested Node script whether main's tip needs deploying; only then do the existing `test` and `deploy` jobs run for the tip, in the same `deploy-prod` group, with the same guard and health check. Amended 2026-11-25 (po Decision in the ticket's Notes, settling this plan's intent gap): a `[skip ci]` commit needs no deploy, so the check is a no-op when every commit since production's SHA carries a skip token and otherwise judges the newest commit without one; it deploys only a deploy cancelled by the `deploy-prod` concurrency group or a push with no run on `main`, and treats every other cancellation, or one it cannot attribute to the group, as deliberate (no deploy, a notice naming the run); no kill switch. It also folds in the review's plan-rework rows: only `main` push runs count, queried for the exact SHA rather than the first page of runs; the rollback rule's landed time comes from a `main` push run; `test` requires the check job's success; a deploy skipped because production changed since the check says so in the step summary; a test pins the job and step names the script reads from `ci.yml`.

## Boundaries & Constraints

**Always:** Push, branch-push and rollback (`workflow_dispatch`) runs behave exactly as before. The scheduled path deploys only `github.sha` of the scheduled run (main's tip), only after a green `test` in that run, only through the existing `deploy` job and its guard. Every no-op says why in a `::notice::` (or `::warning::` when production is in a state a person should look at) and in the step summary. The decision fails closed: any error reading production or the GitHub API fails the `catch-up` job, and nothing is tested or deployed.

**Never:** Change, add, read or print any secret or variable value; change the host, the tunnel, repo settings, image build/tag, or the rollback procedure; run anything against production or project `todo`; put the deploy job in an environment (story 2.17); deploy a commit that is not main's tip, or one older than or unrelated to what production runs; undo a rollback; re-test a red tip on every schedule; touch README sections other than Deploy and Roll back.

## I/O & Edge-Case Matrix

Tip T = scheduled run's `github.sha`; D = SHA production runs. "Tip runs" = other runs of `ci.yml` for T with event `push` or `schedule`, latest attempt, newest first.

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| Equal | D = T | no deploy: "production already runs main's tip T" | notice |
| Tip older | T is an ancestor of D | no deploy: production runs newer D | notice |
| Unrelated / none | D empty, not 40-hex, unknown to git, or neither ancestor of the other | no deploy | warning |
| In progress | a tip run not `completed` (incl. a deploy pending in `deploy-prod`) | no deploy: that run deploys it | notice |
| Rolled back | a successful `workflow_dispatch` run on `main` created after T landed (T's earliest push run, else T's committer date) | no deploy until the next push | notice |
| Red tip | newest attempted tip run: `test` failed/timed out | no deploy (no re-test loop) | notice |
| Deployed before | newest attempted tip run: `deploy` succeeded and its "Start production" step succeeded | no deploy (production was changed by hand) | warning |
| Deploy failed | newest attempted tip run: `deploy` failed/timed out | no deploy; a person re-runs | warning |
| Cancelled deploy | T newer; newest attempted tip run: `test` or `deploy` cancelled | deploy T | notice |
| No run | T newer; no attempted tip run | deploy T | notice |
| Not attempted | a tip run whose `test` was skipped (a no-op scheduled run) or whose deploy guard skipped "Start production" | ignored | — |
| Raced | production changed between `catch-up` and the scheduled `deploy` | deploy job's guard skips; next schedule decides again | notice |
| API / SSH error | GitHub API non-2xx, SSH failure | `catch-up` fails, nothing runs | job fails |

</intent-contract>

## Code Map

- `/Users/idris/me/todo-wt/patches/bug-26-first-attempt.patch` -- the first attempt (applies to this baseline with `git apply`): `scripts/deploy-catch-up.mjs`, its unit test, `scripts/ci-workflow-steps.test.ts`, the `ci.yml`, README and `vitest.config.ts` changes. Start from it and change what this plan's Design Notes change; keep what they do not (KEEP list in the Plan Change Log).
- `.github/workflows/ci.yml` -- the one workflow (AD-18). Baseline: `test` `if: github.event_name == 'push'`; `deploy` `needs: test`, `if: !cancelled() && ref main && (dispatch || needs.test.result == 'success')`, `concurrency: deploy-prod`; steps "Set up SSH to the host", "Skip if a newer SHA is already deployed" (`id: guard`, `docker ps --filter label=com.docker.compose.project=todo --filter label=com.docker.compose.service=api --format '{{.Image}}'`, `deployed=${image##*:}`), "Download the tested images" and "Push the tested images to GHCR" gated on push, "Start production". Change no other step's commands.
- GitHub data, checked 2026-11-25 on this repo: the jobs API names jobs by id (`test`, `deploy`); a job's `id` is its check-run id (`/check-runs/{id}/annotations`); step names containing a secret's value are masked (`Resolve and check out the SHA to ***`), so the only deploy step the script may match is `Start production`, and annotation text may show `***` where a secret's value appears. `head_sha` filters need the full 40-hex SHA. No run on this repo has been cancelled yet, so the group's cancellation annotation could not be read from real data.
- `vitest.config.ts` -- `unit` include gains `scripts/**/*.test.ts`.
- `README.md` -- `## Deploy` and `## Roll back` only (story 2.9 edits README in parallel).

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/deploy-catch-up.mjs` -- new, from the first attempt, changed to the Design Notes' decision order and queries: skip-token detection, the deploy candidate C, main-only runs, scheduled runs read by status with pagination, group-cancellation attribution from the deploy job's annotations, landed time from C's main push run. Export the names it matches (`test`, `deploy`, `Start production`) as constants. Fail closed on any git or API error and on more than 10 pages of one list.
- [ ] `scripts/deploy-catch-up.test.ts` -- every row of the Design Notes' effective matrix, the skip tokens, pagination, attribution (group message, `***`-masked message, a person's cancel, no annotations) and `main` as a dry run.
- [ ] `scripts/ci-workflow-steps.test.ts` -- from the first attempt, plus: the raced skip writes to `$GITHUB_STEP_SUMMARY`; `ci.yml` has jobs `test` and `deploy` with no `name:` override and a `deploy` step named exactly `Start production` (the script's exported constants).
- [ ] `vitest.config.ts` -- as the first attempt.
- [ ] `.github/workflows/ci.yml` -- as the first attempt, plus: `catch-up` permissions add `checks: read`; `test`'s `if:` requires `needs.catch-up.result == 'success'` with `deploy == 'true'` on schedule; the guard's raced skip also appends its reason to `$GITHUB_STEP_SUMMARY`.
- [ ] `README.md` -- Deploy and Roll back as the first attempt, rewritten for the effective matrix: `[skip ci]` commits, deliberate cancels, group cancels.

**Acceptance Criteria:**
- Given a push to any branch or a `workflow_dispatch` rollback, when the workflow runs, then `catch-up` is skipped and the baseline's jobs and steps run with the baseline's conditions, plus the actionlint step at the start of `test`.
- Given the branch's CI, when it runs, then `pnpm test:all` (through its `unit` project) passes the catch-up tests and the actionlint step reports no error.
- Given the merged workflow on `main`, when a scheduled run finds production on main's code (the tip, or only `[skip ci]` commits after it), then `catch-up` shows a "Deploy catch-up" notice naming the SHA and `test` and `deploy` are skipped.

## Implementation Notes

- Re-plan of 2026-11-25: the first attempt's notes described code that was reverted; it is kept whole in the patch named in the Code Map.
- Implementation of 2026-11-25: started from `bug-26-first-attempt.patch` (`git apply`), then changed per the Design Notes. `scripts/deploy-catch-up.mjs`: exports `TEST_JOB`, `DEPLOY_JOB`, `START_STEP`, `MAX_PAGES`, `hasSkipToken`, `cancelledByGroup`; new `git.firstParentLog(D, T)` (`git log --first-parent -z --format=%H%n%B D..T`) gives S and C; outcome `cancelled-by-group` from the deploy job's `/check-runs/{job id}/annotations` (message or title matching `higher priority waiting request for '(deploy|***)-prod'`), else `cancelled`; facts are `candidate`, `pushRunsOfCandidate`, `running`, `rollback`, `newest`, and `decide` applies rows 1-13 in order. Queries are read in the matrix's order and stop once a row matches (row 5 found: no dispatch or jobs read; row 6 found: no jobs read). Runs are also filtered client-side by `event`, `head_branch == main` and exact `head_sha`, in case the API ignores a filter.
- Deviation, for the Never "re-test a red tip on every schedule": scheduled runs are listed by `status=failure`, `status=timed_out` and `status=cancelled` (the plan names failure and cancelled). If GitHub concludes a run with a timed-out job as `timed_out`, the two-list version would miss it and fall through to an older group-cancelled run, re-testing a timed-out tip.
- `realGit` is exported with a `cwd` parameter, so `firstParentLog`, `isCommit`, `isAncestor` and `committerDate` are tested against a real temporary repository (a `--no-ff` merge, `[skip ci]` and `skip-checks: true` messages).
- Skip tokens are matched exactly as listed (case-sensitive); the `skip-checks` trailer as a line `skip-checks: true` or `skip-checks:true`.
- ci.yml: `catch-up` gains `checks: read`; `test`'s `if:` requires `needs.catch-up.result == 'success' && needs.catch-up.outputs.deploy == 'true'` off push; the guard's raced skip writes its reason as a notice and appends `### Deploy catch-up` and the reason to `$GITHUB_STEP_SUMMARY` (it now prints `${CHECKED:-none}`). The header comment names the group cancel and `[skip ci]`. No other step's commands changed.
- Known limits, accepted by the Design Notes' queries: a scheduled run that deployed concludes `success` and is not listed, so row 8 sees only C's push runs; if a scheduled run deployed the tip and production was then changed by hand without a `workflow_dispatch` run, the decision falls to the older runs (a group-cancelled push run would redeploy the tip). The annotation text of a group cancel is taken from GitHub's documented wording and the masked form; no run on this repo has been cancelled yet, so it is unchecked against real data. If the text differs, a group cancel reads as deliberate (no deploy, a notice naming the run), which fails safe.
- Verification: `pnpm test` 690 passed (129 in `scripts/`); `pnpm typecheck` passed. Six hand mutations of the script (no current-run exclusion, no client branch filter, no cancelled list, no pagination, first run decides, no skip tokens) each failed tests, then the file was restored. actionlint was not run: the `uvx` command was refused by this session's permission classifier and no local `actionlint` exists; CI's pinned actionlint step in `test` runs it on the branch push.
- Follow-up pass (2026-11-25, parent): added `catch-up-gate` (schedule only, after a green `test`): `node scripts/deploy-catch-up.mjs gate` reads this run's `run_started_at` and one page of `workflow_dispatch` runs on main, and writes `clear=false` if any is unfinished or was created or started after this run started. `deploy` now `needs: [catch-up, test, catch-up-gate]`, and on schedule its `if:` also requires `catch-up`'s `deploy == 'true'` and the gate's `clear == 'true'`, so a blocked scheduled deploy is skipped and never joins `deploy-prod`. Row 6 now counts any completed dispatch on main after C landed, ordered by latest attempt. The `skip-checks` trailer is matched only as the last line after a blank line (CRLF tolerated). Row 11 quotes every annotation. The reasons and README say "the next push to main that runs CI". New tests: `gate`, the job graph evaluated from `ci.yml` (11 scenarios and the deploy step gates), the CLI against a local HTTP server. `pnpm test` 735 passed; typecheck and actionlint (1.7.12, shellcheck 0.11.0) clean. Mutations (dropping `!cancelled()` from `test`, `schedule` from the GHCR push step, the gate from `deploy`) each fail a test.

## Plan Change Log

### 2026-11-25 — Re-plan after the first review's intent gap (po Decision in the ticket's Notes)
- Trigger: review rows `[skip ci]` tip (high), M-in-progress-under-a-bookkeeping-tip (medium), deliberate cancel (medium), and the bad_plan/patch rows (page-1 run reading, landed time, branch runs, `needs.catch-up.result`, raced summary, name drift).
- Amended: Code Map, Tasks, Acceptance Criteria, Design Notes (effective matrix, queries, attribution), Verification. The contract's Approach was amended by the coordinator from the po Decision; its matrix is unchanged, and the Design Notes say how the two combine.
- Known-bad states avoided: testing and deploying `[skip ci]` tips; a second test while the merge under a bookkeeping tip is testing; deploying what a person cancelled; losing the decisive run beyond page 1 of noisy no-op scheduled runs; branch runs read as main's; a rollback before the tip landed counted as after it; `test` running after a failed `catch-up`.
- KEEP: the `catch-up` job's shape (schedule only, not in `deploy-prod`, four `DEPLOY_*` secrets, `set -o pipefail` with `sed -n 1p`, the script with `GH_TOKEN`); `deploy` `needs: [catch-up, test]`; the guard's schedule-only `CHECKED` skip; `push || schedule` on the guard, download and GHCR push steps; the API read only when T is newer; printable-only image tags; `::error` and exit 1 on failure; the pinned actionlint step; `scripts/ci-workflow-steps.test.ts`'s extraction of `run:` blocks with a fake `ssh`.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 29 findings — high 2, medium 7, low 14, false 4, maybe-false 0 (the intent-alignment auditor's 10 divergence observations are triaged as findings)
- attempted change saved, then reverted: [bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed-plan.patch](bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed-plan.patch) (applies to 32c3365 with `git apply`)
- findings:
  - `[high]` `[intent_gap]` (blind-hunter) A `[skip ci]` bookkeeping tip (AGENTS.md: "no CI and no deploy") has no run of its own, so `decide` treats it as "No run" and tests and deploys it, recreating production's containers for a `_bmad-output/`-only change. — Verified: schedule events ignore `[skip ci]`; with production on 16cdf23 and main's tip 32c3365 (a `[skip ci]` commit, as are 4 of origin/main's last 8), `gatherFacts` gives `tip-newer` and no tip runs, so `decide` returns deploy. Fixing it changes the contract's matrix (tip runs, "No run"), so it is an intent gap.
  - `[medium]` `[intent_gap]` (blind-hunter) "In progress" counts only runs of T, so with merge M still testing and a bookkeeping commit T on top, the catch-up starts a second 45-minute test and deploy. — Verified in `decide`: M's run is not a tip run; the result is "No run", deploy. Same root cause as the row above (a `[skip ci]` tip).
  - `[low]` `[reject]` (blind-hunter) The "a person should look" warnings alert nobody and repeat 48 times a day. — Real, but the ticket asks only that the run says so; failing the job or notifying is a new design choice, more than a direct correction.
  - `[medium]` `[intent_gap]` (blind-hunter) A run a person cancelled on purpose summarises as `cancelled`, so the catch-up deploys that commit within 30 minutes; before this change a cancel stopped the deploy. — Verified in `summariseRun` (test or deploy `cancelled` → `cancelled`) and `decide` (→ deploy). The matrix's "Cancelled deploy" row makes no distinction between a cancel by the `deploy-prod` group and a cancel by a person; which one the ticket means is a question for the user.
  - `[low]` `[reject]` (blind-hunter) The plan's acceptance criteria contradict the diff (actionlint step added on push; actionlint is not part of `pnpm test`). — The fix is to edit this build's plan.
  - `[low]` `[reject]` (blind-hunter) The job-level `if:`/`needs:` gating has no test. — Checked by inspection for push, branch push, dispatch and schedule; a test could only assert the YAML text. Noted for the re-plan.
  - `[medium]` `[bad_plan]` (blind-hunter) The landing time comes from T's earliest push run on any branch, else T's committer date, so a rollback before T reached main can count as after it and suppress catch-up indefinitely. — Verified in `gatherFacts` (`pushes` not filtered by `head_branch`; committer-date fallback). Re-plan: date the landing from a push run on `main`, or from the branch's activity, never from the committer date alone.
  - `[low]` `[reject]` (blind-hunter) `realGit`, `realApi` and the CLI entry point have no tests. — Each fails closed (an exception exits 1), and it was checked by a manual dry run; an injection harness is more than a direct correction.
  - `[false]` `[reject]` (blind-hunter) Plan bookkeeping: unchecked task boxes, an empty triage log, `ticket: '15'` against #26. — The triage log is written at this step; `ticket` is `tickets.py find`'s id (15), as the template requires; the checkboxes are a plan edit.
  - `[low]` `[reject]` (blind-hunter) The SSH setup and the `docker ps` read are copied across jobs, with different failure handling. — Deliberate: the deploy guard is left as it was (AC2), and the catch-up's read fails closed. A shared composite action would change the deploy job's steps.
  - `[high]` `[bad_plan]` (edge-case-hunter) Only the first 100 runs for T are read; scheduled no-op runs for T add 48 a day, so after about 50 hours the red, deploy-failed or deployed run drops off page 1 and the decision becomes "No run", deploy. — Verified: `per_page=100`, newest first, with no pagination; each no-op scheduled run has head_sha T. It also fetches jobs for up to 100 runs every 30 minutes. Re-plan: query push runs and attempted scheduled runs without reading the no-op ones (for example by event and status filters), with a bounded number of calls.
  - `[medium]` `[bad_plan]` (edge-case-hunter) A branch push of T before it reached main, or a fallback to the committer date, sets the landing time too early, so the rollback rule fires wrongly. — Same root cause as the blind-hunter landing-time row.
  - `[low]` `[bad_plan]` (edge-case-hunter) An in-progress branch-push run of T makes the check wait, with a notice saying "it deploys the tip", which a branch run never does. — Verified: tip runs are not filtered by `head_branch`. Re-plan: count only runs on `main`.
  - `[low]` `[patch]` (edge-case-hunter) If `catch-up` fails after writing `deploy=true` (for example, the step-summary append throws), `test` and `deploy` still run. — Verified: `main` writes `$GITHUB_OUTPUT` before the summary, and `test`'s `if:` does not check `needs.catch-up.result`. Fix for the re-plan: require `needs.catch-up.result == 'success'`. Moot in this pass (halted).
  - `[false]` `[reject]` (edge-case-hunter) A rollback dispatch still queued or running is not counted, so a scheduled deploy could replace the rollback's pending deploy. — The scheduled deploy reaches `deploy-prod` only after its 45-minute `test`; by then the rollback has deployed, and the guard skips because production changed since `catch-up` read it.
  - `[low]` `[reject]` (edge-case-hunter, claim) The new actionlint step runs on every push and adds a Docker Hub dependency. — AC3 invites actionlint; it is pinned by digest and is part of the tests every push runs. Recorded for the user, together with the intent-alignment row below.
  - `[high]` `[bad_plan]` (edge-case-hunter, claim) Only the first 100 runs for the head SHA are read. — Same root cause as the pagination row above.
  - `[low]` `[patch]` (edge-case-hunter, claim) The raced skip in the scheduled guard writes a notice but nothing to the step summary, against the contract's "Always". — Verified. Fix for the re-plan: append the reason to `$GITHUB_STEP_SUMMARY` on that branch. Moot in this pass (halted).
  - `[medium]` `[patch]` (verification-gap) Nothing ties the job names `test` and `deploy` and the step name `Start production` that `summariseRun` matches to `ci.yml`; a rename silently makes every run `not-attempted`, so red tips are re-tested every 30 minutes. — Trusted as filed. Fix for the re-plan: export the names from the script and assert them against `ci.yml` in `scripts/ci-workflow-steps.test.ts`. Moot in this pass (halted).
  - `[false]` `[reject]` (intent-alignment) A red tip, a failed deploy or a hand change are not deployed, against a literal reading of AC1's Then. — The ticket's Given names only a cancelled deploy and a missing run, and its Boundaries forbid changing rollback; the Design Notes record why.
  - `[low]` `[bad_plan]` (intent-alignment) "Rolled back" is inferred from time, so any later successful dispatch, even one that rolls forward, suppresses catch-up. — Same root cause as the landing-time rows; the re-plan should also say what a roll-forward dispatch means.
  - `[low]` `[reject]` (intent-alignment) "In progress" includes a deploy pending in `deploy-prod`, so the catch-up waits one more schedule. — By design: that run may still deploy; the next schedule catches up if it is cancelled.
  - `[low]` `[bad_plan]` (intent-alignment) Tip runs are not filtered by branch. — Same root cause as the edge-case branch-run row.
  - `[false]` `[reject]` (intent-alignment) An unrelated or unreadable production SHA gives a warning and no deploy. — Matches the Boundary "never deploy … older than what production runs": without a known relation, "not older" cannot be shown.
  - `[low]` `[reject]` (intent-alignment) The catch-up's read is stricter than the guard's (`pipefail`, `sed -n 1p`). — Same `docker ps` command; it fails closed on purpose, and the guard is left unchanged (AC2).
  - `[medium]` `[reject]` (intent-alignment) A scheduled deploy shares `deploy-prod` and can replace a newer push's pending deploy. — Real; the caller required the `deploy-prod` group, GitHub offers no ordering, and the next schedule catches that tip up (Design Notes). Recorded for the user.
  - `[low]` `[reject]` (intent-alignment) actionlint now runs on every push. — Same as the edge-case actionlint row.
  - `[low]` `[reject]` (intent-alignment) The changed job conditions have no test. — Same as the blind-hunter gating row.
  - `[medium]` `[reject]` (intent-alignment) AC1's runtime surface (the scheduler, `deploy-prod`, the real API responses, SSH, the health check) is not exercised on the branch. — Inherent: the deploy path runs only on `main`. The manual check after merge covers it.

### 2026-11-25 — Review pass (re-plan)
- verdicts: 35 findings — high 0, medium 8, low 19, false 5, maybe-false 3 (the intent-alignment auditor's 8 divergence items are triaged as findings; the blind hunter's row-5 finding has two claims, logged as two rows)
- findings:
  - `[medium]` `[patch]` (verification-gap) The CLI entry and its exit 1 were never run by a test, so a broken entry guard or a dropped `exitCode` would make every scheduled run a silent no-op. — Patched: `the CLI, as ci.yml runs it` spawns `node scripts/deploy-catch-up.mjs` in a temp repo: production on the tip gives exit 0 with outputs, notice and summary; an unreachable API gives exit 1, an `::error` line and no output. Setting `exitCode = 0` fails the test.
  - `[medium]` `[patch]` (verification-gap) Nothing pins the `catch-up` outputs wiring (`steps.decide.outputs.*`, `id: live`, `DEPLOYED`, the `needs.catch-up.outputs.*` readers). — Patched: three tests in `scripts/ci-workflow-steps.test.ts` check the outputs map, both step ids, the `DEPLOYED` env, `test`'s `if:` and the guard's `CHECKED`.
  - `[medium]` `[patch]` (intent-alignment 1) The group's cancellation is attributed by annotation text never seen on this repo. — Real; the wording is an unverified assumption (deferred). Patched: row 11's notice now quotes the deploy job's first annotation, so the first deliberate-looking cancel shows a person the real wording.
  - `[low]` `[reject]` (intent-alignment 2) A successful scheduled deploy is never listed, so a later change by hand without a dispatch falls back to older runs. — Known, accepted limit of the plan's queries; rare (production changed by hand outside the workflow).
  - `[low]` `[patch]` (intent-alignment 3) On schedule, when production moved to the tip or newer since the check, the guard's first branch printed only a notice, with no step summary. — Patched: on schedule only, that branch also writes the reason to `$GITHUB_STEP_SUMMARY`; push still writes none. Tested both ways.
  - `[false]` `[reject]` (intent-alignment 4) Row 13 (C has a main push run, none attempted) warns where the literal matrix would deploy. — The amended Approach deploys only a group cancel or "a push with no run on main"; C has such a run, so it is not that case.
  - `[false]` `[reject]` (intent-alignment 5) The landed time uses C, not T. — The amended Approach: the landed time comes from a main push run, which only C has. It errs towards no deploy.
  - `[low]` `[reject]` (intent-alignment 6) Push, branch and dispatch invariance is not exercised at the job-graph level. — Checked by inspection; actionlint (run locally, exit 0) type-checks the expressions; the guard's bash is run for push. A job-graph test could only assert YAML text.
  - `[medium]` `[patch]` (intent-alignment 7) A rollback still running is invisible to rows 5 and 6. — Grouped with the edge-case rollback-in-progress row below.
  - `[false]` `[reject]` (intent-alignment 8) `catch-up` reads four `DEPLOY_*` secrets; actionlint is added on push. — The Approach requires reading production over SSH as the guard does (an existing secret, none added); the plan's AC names the actionlint step.
  - `[medium]` `[patch]` (edge-case-hunter) A `workflow_dispatch` rollback still in progress (not yet `success`) is not seen: if `catch-up` reads production after the rollback started production but before its run concluded, `CHECKED` is the rollback's SHA and the scheduled deploy undoes it. — Verified (the dispatch query read only `status=success`). Patched: one page of dispatch runs on main, unfiltered; any not completed is row 5 ("a run by hand … is still in progress on main"), checked first; row 6 reads successes from the same page. Tested; removing the check fails the test.
  - `[low]` `[reject]` (edge-case-hunter) A scheduled deploy queued after a pending rollback deploy replaces it in `deploy-prod`, and the guard sees production unchanged. — Real but narrow (a rollback pending behind a running deploy just as a scheduled deploy queues); push deploys already replace pending rollbacks the same way; the fix needs an API check inside the deploy job, more than a direct correction.
  - `[low]` `[patch]` (edge-case-hunter) Runs are ordered by `created_at`, so a re-run attempt of an older run is ranked by its creation. — Patched: ordering uses `run_started_at` (moved by a re-run), else `created_at`. Tested both ways.
  - `[low]` `[reject]` (edge-case-hunter) An in-progress re-run of a scheduled run older than the newest 20 for that SHA is missed by row 5. — Unlikely (a person re-running an old scheduled run); the result is one duplicate test, and the guard still protects production.
  - `[maybe-false]` `[reject]` (edge-case-hunter) A test job that hits `timeout-minutes` may be reported `cancelled`, so it reads as a deliberate cancel. — Settle by observing a timed-out job's API conclusion. If true, low: the outcome is still no deploy (safe), only the notice's wording is wrong.
  - `[maybe-false]` `[reject]` (edge-case-hunter) A deploy job that hits its timeout may be reported `cancelled` with no group annotation, giving a notice not a warning. — Same as above; no deploy either way.
  - `[low]` `[reject]` (edge-case-hunter) A list of exactly 1,000 runs fails with "More than 10 pages". — Needs 1,000 failed or cancelled scheduled runs of one SHA; fails closed.
  - `[low]` `[reject]` (edge-case-hunter) Many skip-token commits between C and T cost four API calls each. — Bookkeeping commits between an undeployed code commit and the tip are few; the cost is well under the token's hourly limit.
  - `[false]` `[reject]` (edge-case-hunter, claim) A merge commit whose message carries `[skip ci]` carries code and is skipped. — GitHub runs no push CI for it either, and the po Decision (ticket Notes) says a `[skip ci]` commit needs no deploy.
  - `[low]` `[reject]` (edge-case-hunter, claim) "More than 10 pages" fires at exactly 10 full pages. — Same as the 1,000-runs row.
  - `[medium]` `[patch]` (edge-case-hunter, claim) "Never undo a rollback": an in-progress dispatch is invisible. — Same root cause as the rollback-in-progress row; patched there.
  - `[false]` `[reject]` (blind-hunter) Code commits quoting a skip token are never deployed. — Same as the merge-commit claim: the po Decision, and GitHub's own push skip.
  - `[low]` `[reject]` (blind-hunter) Failed `catch-up` runs pile up under `status=failure` and each costs a jobs call; after about 21 days of outage, MAX_PAGES fails every check. — Real only over weeks of SSH or API outage, which the failing runs themselves show; it fails closed.
  - `[low]` `[reject]` (blind-hunter) No grace period before row 12: a schedule seconds after a merge, before the push run exists, tests and deploys alongside it. — The window is seconds; the result is one duplicate test and a deploy of the same tip; a time guard adds complexity.
  - `[low]` `[reject]` (blind-hunter) Row 5 misses an in-progress push run of an older code commit between D and C. — That run deploys an older commit than C, so waiting for it is not needed; the guard keeps the newer SHA.
  - `[medium]` `[patch]` (blind-hunter) Row 5 does not see a manual deploy still running. — Same root cause as the edge-case rollback-in-progress row; patched there.
  - `[low]` `[reject]` (blind-hunter) Two overlapping scheduled runs each see the other in progress and both do nothing. — The next schedule decides 30 minutes later; nothing is harmed.
  - `[low]` `[patch]` (blind-hunter) Ordering by `created_at`, not latest attempt. — Same as the edge-case ordering row; patched there.
  - `[low]` `[patch]` (blind-hunter) The README does not say that schedules are best-effort or that GitHub turns them off after 60 days without activity. — Patched: one sentence in Deploy.
  - `[low]` `[reject]` (blind-hunter) "A person should look" warnings reach no one. — The ticket asks that the run says so; notification is a new design choice.
  - `[maybe-false]` `[defer]` (blind-hunter) The group-cancellation wording is unverified, and a deploy job skipped by its `if:` might take part in `deploy-prod`. — Deferred (medium, unverified): the wording. Settle by the first real group cancel after merge (row 11's notice now quotes the annotation). A skipped job taking part in the group is false in practice: every branch push already has a skipped `deploy` in `deploy-prod`, and pending main deploys have not been replaced by them.
  - `[low]` `[reject]` (blind-hunter) actionlint adds a Docker Hub pull to every `test`, and was never run locally. — The plan's AC names the step; it is pinned by digest; it was run locally by the parent (actionlint 1.7.12 with shellcheck 0.11.0, exit 0).
  - `[low]` `[reject]` (blind-hunter) The plan names a patch path on one machine; Tasks unchecked; no result section. — The path is the coordinator's handoff, and every plan in this tree uses worktree paths; the result section is written at Finalize; the checkboxes are a plan edit.
  - `[medium]` `[patch]` (blind-hunter) The fail-closed CLI paths (`realApi`, `::error`, `exitCode`) have no tests. — Same root cause as the verification-gap CLI row; patched there (the unreachable-API case exercises `realApi`'s error path).
  - `[low]` `[reject]` (blind-hunter) The full-access deploy key is used 48 times a day for a read. — A restricted key needs a new secret and a host change, both forbidden here; story 2.17 (#64) moves the secrets into a protected environment.

### 2026-11-25 — Review pass (follow-up, review pinned thorough)
- verdicts: 30 findings — high 3, medium 6, low 15, false 5, maybe-false 1 (the intent-alignment auditor's 9 divergence items and the coordinator's named risk are triaged as findings)
- findings:
  - `[high]` `[patch]` (coordinator) A scheduled `deploy` queued in `deploy-prod` replaces a rollback deploy still pending there (GitHub keeps one pending job per group), silently undoing a person's rollback; the check waits for a queued, waiting or running dispatch only at decision time, 45 minutes before the deploy queues. — Verified: `catch-up` checks `status !== 'completed'` (covers queued, waiting, pending, requested, in_progress) but nothing re-checks before `deploy` joins the group, and a pending job is replaced at queue time, whatever the guard later decides. Patched: new `catch-up-gate` job (schedule only, after a green `test`, `actions: read`) runs `node scripts/deploy-catch-up.mjs gate`: clear only when no `workflow_dispatch` run on main is unfinished and none was created or started after this run started. On schedule, `deploy`'s `if:` now requires `catch-up`'s `deploy == 'true'` and the gate's `clear == 'true'`, so a blocked deploy is skipped and never joins `deploy-prod`. Tests: `gate` for each unfinished status, a rollback during the run, a re-run, another branch, an API error; the job graph evaluated from `ci.yml` (gate clear, not clear, failed). Residual window: the seconds between the gate's API read and `deploy` joining the group.
  - `[medium]` `[patch]` (verification-gap) The job and step `if:` conditions (push, branch, dispatch, schedule) were only pinned as text; dropping `!cancelled()` or `push ||` from `test`, or `schedule` from the GHCR push step, passed every test. — Patched: `the job graph, evaluated from ci.yml` reads each job's `if:`/`needs:` and the deploy steps' `if:`, evaluates them with GitHub's implicit `success()` rule for 11 event scenarios and the step gates. Each of those three mutations fails it.
  - `[false]` `[reject]` (intent-alignment a) Row 13 warns where the literal matrix would deploy. — carried: the amended Approach deploys only a group cancel or a push with no run on main.
  - `[low]` `[reject]` (intent-alignment b) A successful scheduled deploy is never listed, so "deployed before" via a scheduled run is invisible. — carried: known, accepted limit (production changed by hand outside the workflow).
  - `[false]` `[reject]` (intent-alignment c) The landed time uses C, not T. — carried: the Approach takes it from a main push run, which only C has; errs towards no deploy.
  - `[false]` `[reject]` (intent-alignment d) A cancelled `test` counts as deliberate, against the matrix's "test or deploy cancelled". — The amended Approach: only a deploy cancelled by the group deploys.
  - `[low]` `[reject]` (intent-alignment e) actionlint changes every push run. — carried: named in the plan's AC; pinned by digest.
  - `[false]` `[reject]` (intent-alignment f) `catch-up` reads the `DEPLOY_*` secrets and runs `docker ps` on production. — carried: the Approach requires reading production as the guard does; no secret is added.
  - `[false]` `[reject]` (intent-alignment g) First-parent history lets a skip-token merge commit hide the feature commits it brings in. — GitHub runs no push CI for that merge either; the po Decision says such a commit needs no deploy.
  - `[low]` `[reject]` (intent-alignment h) On schedule, an SSH failure in the guard reads as "production changed", naming the wrong cause. — The outcome is no deploy; the guard's read is the push path's, left unchanged.
  - `[maybe-false]` `[defer]` (intent-alignment i) The group-cancel case rests on fixtures written from documented wording; if GitHub's text or shape differs, the bug stays unfixed with no error. — carried: the deferred item. Row 11 now quotes every annotation title and message, so the first real group cancel shows the real text.
  - `[high]` `[patch]` (edge-case-hunter) A→B→A: during the scheduled test, a push deploys N, then a rollback returns production to the SHA `catch-up` read; the guard's `deployed == CHECKED` passes and the scheduled deploy undoes the rollback. — Verified. Patched by the coordinator row's gate: a dispatch created or started after this run started blocks the deploy.
  - `[medium]` `[patch]` (edge-case-hunter) A rollback created before C landed and re-run after it is not row 6, so a group-cancelled C run redeploys T over it. — Verified (`created_at`). Patched: row 6 compares the dispatch's latest attempt (`run_started_at`, else `created_at`). Tested.
  - `[low]` `[patch]` (edge-case-hunter) `skip-checks: true` mid-body counts as a skip, though GitHub reads it only as the final trailer. — Patched: matched only as the message's last line after a blank line. Tests for mid-body, no blank line, trailing blank lines.
  - `[low]` `[patch]` (edge-case-hunter) A CRLF `skip-checks: true\r\n` trailer is missed. — Patched with the trailer rule (CRLF tolerated). Tested.
  - `[low]` `[reject]` (edge-case-hunter) A schedule reading production while a push deploy recreates the api container sees no container and warns falsely. — Transient (seconds of `up -d`); a warning and no deploy, and the next check reads the new SHA.
  - `[low]` `[patch]` (edge-case-hunter) `scripts/ci-workflow-steps.test.ts` commits without `commit.gpgsign=false`, so a signing setup breaks it locally. — Patched.
  - `[medium]` `[patch]` (edge-case-hunter, claim) A rollback whose health check failed concludes `failure` and is ignored by row 6, though it may be live. — Verified. Patched: any completed dispatch run on main after C landed, whatever its conclusion, is row 6 (never undo a rollback). Tested.
  - `[high]` `[patch]` (edge-case-hunter, claim) A rollback back to the same SHA passes the guard. — Same root cause as the A→B→A row; patched by the gate.
  - `[medium]` `[patch]` (blind-hunter) Row 6 still uses `created_at`, so a re-run rollback is missed. — Same as the edge-case re-run row; patched there.
  - `[low]` `[reject]` (blind-hunter) Row 4 trusts commit messages; a skip-token commit that changes code is reported as "main's code". — The po Decision (ticket Notes) settles that a skip-token commit needs no deploy; GitHub runs no CI for its push either.
  - `[low]` `[patch]` (blind-hunter) The `skip-checks` match is looser than GitHub's trailer rule. — Same as the edge-case trailer row; patched there.
  - `[low]` `[reject]` (blind-hunter) Row 5 has no age limit; a run stuck queued for days blocks the catch-up with only a notice. — Unlikely; an age threshold adds a branch; the stuck run itself is visible in Actions.
  - `[low]` `[patch]` (blind-hunter) Row 11 quotes only the first annotation's message. — Patched: every annotation's title and message, joined, whitespace-collapsed, at most 300 characters. Tested.
  - `[low]` `[patch]` (blind-hunter) "The next push to main deploys" is wrong when most pushes are skip-CI commits. — Patched: the reasons and README say the next push to `main` that runs CI (a code merge).
  - `[low]` `[reject]` (blind-hunter) The plan's Design Notes no longer match the code after the patches. — The fix is to edit this build's plan; Implementation Notes record each change.
  - `[medium]` `[patch]` (blind-hunter) Only part of the job wiring is pinned. — Same root cause as the verification-gap job-graph row; patched there.
  - `[medium]` `[patch]` (blind-hunter) `realApi` never runs against a server that answers. — Patched: the CLI test serves a group-cancelled run from a local HTTP server and checks `deploy=true`, the `/repos/owner/repo/` prefix, the auth, accept and API-version headers, and the annotations path.
  - `[low]` `[patch]` (blind-hunter) `deploy` does not check the catch-up's decision itself; a loosened `test` gate would deploy every 30 minutes. — Patched with the gate: on schedule, `deploy` requires `needs.catch-up.outputs.deploy == 'true'`. The job-graph test covers it.
  - `[low]` `[reject]` (blind-hunter) A group cancel re-runs the 45-minute test and builds images tagged with a skip-CI SHA instead of redeploying C's tested artifact. — The contract deploys through the same `test` and `deploy` jobs; a re-run of the cancelled job needs `actions: write` and expires with the one-day artifact. Recorded as a trade-off, not a defect.

## Design Notes

**Precedence.** The contract's Approach was amended on 2026-11-25 by the po Decision; where it and the contract's matrix differ, the Approach wins. The effective matrix below applies both, in this order; the first row that matches decides.

Terms: T = the scheduled run's `github.sha`; D = the SHA production runs; "skip token" = `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]` anywhere in the message, or a `skip-checks: true` trailer line; S = `git rev-list --first-parent D..T`, newest first; C = the newest commit in S without a skip token; "main push runs" = `ci.yml` runs with `event=push&branch=main&head_sha=<C>`; "scheduled runs" = runs with `event=schedule&branch=main` whose head SHA is in S from T down to C, the current run excluded. A run's outcome comes from its latest attempt's jobs, as in the first attempt, with the deploy job's cancellation split in two: `cancelled-by-group` when one of its annotations matches `higher priority waiting request for '(deploy|***)-prod'`, else `cancelled` (deliberate). A cancelled `test` is deliberate.

| # | Case | Decision |
|---|---|---|
| 1-3 | Equal, tip older, unrelated or none | as the contract's matrix |
| 4 | every commit in S has a skip token | notice, no deploy: production runs main's code; only skip-token commits since D |
| 5 | a main push run of C, or a scheduled run, not completed | notice, no deploy: that run is still going (names it) |
| 6 | a successful `workflow_dispatch` run on main created after C landed (C's earliest main push run; with none, C's committer date, which errs towards no deploy) | notice, no deploy until the next push |
| 7 | newest attempted run (main push runs of C and scheduled runs together) is red | notice, no deploy |
| 8 | ... deployed (Start production succeeded) | warning, no deploy |
| 9 | ... deploy failed | warning, no deploy |
| 10 | ... `cancelled-by-group` | notice, deploy T |
| 11 | ... `cancelled` (deliberate, or not attributable) | notice naming the run, no deploy |
| 12 | no attempted run, and C has no main push run | notice, deploy T (a push with no run on main) |
| 13 | no attempted run, but C has a main push run | warning, no deploy: production moved off C some other way |

**Queries (bounded, fail closed).** (a) main push runs of C, one page. (b) Scheduled runs for each SHA in S from T down to C: one page of 20, newest first, only for row 5; then `status=failure` and `status=cancelled`, every page (`per_page=100`, at most 10 pages per list, else fail), for rows 7-11. No-op scheduled runs conclude `success`, so they never fill those lists. (c) Jobs only for the candidate runs, newest first, stopping at the first attempted one; annotations only for a cancelled deploy job. (d) One page of successful `workflow_dispatch` runs on main, newest first, for row 6. Permissions: `contents: read`, `actions: read`, `checks: read`.

The rest of the first attempt's Design Notes still hold: no deploy in a red-tip loop or over a rollback; a scheduled deploy can still replace a pending push deploy in `deploy-prod`, and the next schedule catches that tip up; `catch-up` stays outside `deploy-prod`, and story 2.17 must give it `environment: production` too, since it reads deploy secrets.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, including both `scripts/*.test.ts` files.
- `pnpm typecheck` -- expected: pass.
- `uvx --from actionlint-py actionlint -shellcheck "$(uvx --from shellcheck-py which shellcheck)" .github/workflows/ci.yml` -- expected: no output, exit 0.
- `git diff 562a8c5548d4bec7d0032202c5725581313009c6 -- .github/workflows/ci.yml` -- expected: only the changes listed in the ci.yml task.

**Manual checks (if no CLI):**
- After merge, the first scheduled run on `main` (Actions › CI, event `schedule`) shows the `catch-up` job's "Deploy catch-up" notice, and with production on main's code, `test` and `deploy` skipped.

## First Attempt Result (2026-11-25, blocked, superseded)

Status: blocked
Blocking condition: intent gap (review, 2026-11-25). `tickets.py mark` was refused ("store is github: change status through the store's write verb"), and this run may not edit the issue, so the status is set here only.

**Unanswered questions**
1. **`[skip ci]` tips.** A scheduled run's `github.sha` is often a bookkeeping commit pushed with `[skip ci]`. AGENTS.md says such a push gets "no CI and no deploy". It has no run, so the contract's "No run" row tests and deploys it. On 2026-11-25, main's tip 32c3365 and 4 of origin/main's last 8 commits are like this. Should the catch-up:
   - (a) treat `[skip ci]` commits as needing no deploy: no deploy when every commit in D..T carries a skip token, and otherwise judge the run of the newest commit in D..T without one (its in-progress, red, cancelled or no-run state) while still deploying T; or
   - (b) deploy such tips like any other: one extra 45-minute test and a container restart after every bookkeeping push, plus a second test and deploy while the merge under it is still testing?
2. **Cancelled on purpose.** A run that a person cancelled now gets caught up within 30 minutes; before, a cancel stopped the deploy. Should the catch-up:
   - (a) catch up any cancelled test or deploy, as now, documented in the README;
   - (b) catch up only a deploy cancelled by the `deploy-prod` group, if that can be told apart (for example from the job's cancellation annotation); or
   - (c) add a kill switch, such as a repository variable `catch-up` checks? This is a settings change the user would make.

**For the re-plan (bad_plan and patch items, moot in this pass)**
- Do not read only page 1 of runs for T. No-op scheduled runs add 48 a day, so after about 50 hours the decisive run drops off page 1. Each check also fetches jobs for up to 100 runs.
- Date the tip's landing from a push run on `main`, never from a branch push or the committer date alone. Decide what a roll-forward dispatch means for the rollback rule.
- Count only runs on `main` as the tip's runs.
- `test` must also require `needs.catch-up.result == 'success'`.
- The raced skip in the scheduled guard must also write to `$GITHUB_STEP_SUMMARY`.
- Assert that the job names `test` and `deploy` and the step name `Start production`, which the script matches, exist in `ci.yml`.

**Attempted change:** [bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed-plan.patch](bug-a-burst-of-merges-can-leave-the-tip-of-main-undeployed-plan.patch). It applies cleanly to 32c3365 and was reverted from the tree. It contains:
- `scripts/deploy-catch-up.mjs` and its 47-test unit file;
- `scripts/ci-workflow-steps.test.ts`, 11 tests that run the guard and read steps of `ci.yml` with a fake `ssh`;
- the `ci.yml` schedule, the `catch-up` job and the `test`/`deploy` wiring;
- the actionlint step, the README Deploy and Roll back text, and the `vitest.config.ts` include.

Before the revert: `pnpm test` passed (608, then 619 with the step tests), `pnpm typecheck` passed, and actionlint with shellcheck 0.11.0 reported nothing.

Nothing was committed, pushed or opened as a PR. The todo-test stack lock was never taken.

## Auto Run Result

Status: built (second attempt, after the po Decision settled the first attempt's intent gap).

**Summary.** A `schedule` trigger (at :17 and :47) runs a new `catch-up` job on `main`. It reads the SHA production runs over SSH, the deploy guard's way, and `scripts/deploy-catch-up.mjs` decides, by the Design Notes' effective matrix, whether main's tip needs testing and deploying. It needs none when only `[skip ci]` commits follow production's SHA. It deploys only when the judged commit's deploy was cancelled by the `deploy-prod` group, or when no push to `main` ran CI for it. In every other case it does nothing and says why in a "Deploy catch-up" notice or warning and in the step summary. When it does deploy, the existing `test` and `deploy` jobs run for the tip, with the existing guard, which on schedule also skips if production changed since the check.

**Files changed**
- `.github/workflows/ci.yml` -- schedule, the `catch-up` job, `test`/`deploy` wiring, the guard's schedule-only skip and summary, the pinned actionlint step.
- `scripts/deploy-catch-up.mjs` -- the decision: skip tokens, candidate commit, bounded run queries, group attribution, outputs.
- `scripts/deploy-catch-up.test.ts` -- 123 tests: every matrix row, the queries, attribution, `main` dry runs, `realGit` and the CLI on temporary repositories.
- `scripts/ci-workflow-steps.test.ts` -- 16 tests: the guard and read steps run from `ci.yml` with a fake `ssh`; job, step and output names pinned.
- `vitest.config.ts` -- the `unit` project includes `scripts/**/*.test.ts`.
- `README.md` -- Deploy (the catch-up) and Roll back (a rollback stays live until the next push) only.

**Review findings.**
- Patches applied: 12 rows, 7 fixes:
  - a run by hand still in progress on `main` makes the check wait;
  - runs are ordered by their latest attempt;
  - row 11's notice quotes the cancelled deploy's annotation;
  - on schedule, the guard writes its skip reason to the step summary in both branches;
  - the CLI test;
  - the output-wiring tests;
  - the README note on schedule limits.
- Deferred: 1 (the group annotation wording, above).
- Rejected: 22 rows, each with its reason in the Review Triage Log.

**Follow-up review: true.** This pass patched 8 medium rows. The risk not yet seen by a fresh review is the new row-5 check on dispatch runs, which is now the first gate before every deploy, and the CLI and wiring tests added in this pass. The group annotation wording can only be settled on `main`.

**Verification (parent, after patches).**
- `pnpm test`: 700 passed.
- `pnpm typecheck`: exit 0.
- actionlint 1.7.12 with shellcheck 0.11.0 on `ci.yml`: no output, exit 0.
- Mutation checks:
  - `exitCode = 0` fails the CLI test;
  - dropping the dispatch in-progress check fails its test.
- `git diff 562a8c5 -- .github/workflows/ci.yml` holds only the planned changes.
- No todo-test stack was used, so the lock was never taken.

**Residual risks.**
- The scheduled and deploy paths only run on `main`.
- The group annotation wording is unverified. If it is wrong, the result is safe: no deploy, and a notice quoting the real text.
- A scheduled deploy can still replace a pending push deploy, or a pending rollback, in `deploy-prod`. The next schedule then catches that tip up.
- `catch-up` reads deploy secrets, so story 2.17 must give it `environment: production` too.

### Follow-up pass (2026-11-25, review pinned thorough)

- **Summary.** A new `catch-up-gate` job sits between a green scheduled `test` and `deploy`. When any `workflow_dispatch` run on `main` is unfinished, or started during the scheduled run, the scheduled `deploy` is skipped. A skipped job never joins `deploy-prod`, so it can never replace a pending rollback or undo one that already ran.
- Row 6 now counts any completed rollback, from its latest attempt.
- The `skip-checks` trailer follows GitHub's rule.
- The workflow's job graph is evaluated in tests.
- The CLI is tested against a local HTTP server.
- **Files changed this pass:** `.github/workflows/ci.yml`, `scripts/deploy-catch-up.mjs`, `scripts/deploy-catch-up.test.ts`, `scripts/ci-workflow-steps.test.ts`, `README.md` (Deploy and Roll back only).
- **Findings.** 17 rows patched, grouped into 11 fixes. 0 newly deferred (1 carried). 13 rejected, each with its reason in the triage log.
- **Follow-up review: true.** This follow-up pass patched a high (a scheduled deploy could replace or undo a rollback). The new `catch-up-gate` job runs only on `main` and has not been reviewed by a fresh pass. It leaves a window of seconds between its API read and `deploy` joining `deploy-prod`.
- **Verification.**
  - `pnpm test`: 735 passed.
  - typecheck: clean.
  - actionlint: clean.
  - Mutation checks: dropping `!cancelled()` from `test`, `schedule` from the GHCR push step, or the gate from `deploy` each fails a test.
- **Residual risks.**
  - The gate's window of seconds.
  - The group annotation wording is still unverified (deferred).
  - A scheduled deploy can still replace a newer commit's pending push deploy, delaying it up to 30 minutes plus a test. The README now says so.

