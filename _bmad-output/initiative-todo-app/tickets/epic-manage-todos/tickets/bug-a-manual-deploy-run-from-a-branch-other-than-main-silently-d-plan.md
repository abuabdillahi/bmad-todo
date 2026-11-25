---
title: 'A manual deploy run from a branch other than main silently does nothing'
type: bugfix
ticket: '16'
created: '2026-11-25'
status: built
baseline_revision: 'ee55a3f0c1d58e321c24997aaa8818e915ebe72d'
route: oneshot
route_source: auto
risk: medium
review: quick
review_source: auto
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** A rollback is the CI workflow run by hand (`workflow_dispatch`) from `main` with an earlier SHA (AD-18). Started from any other branch or a tag, every job's `if:` is false, so every job is skipped, the run looks finished, and the rollback silently does not happen.

**Approach:** Add one job to `.github/workflows/ci.yml` with `if: github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'` (the design agreed in docs/quality/2026-11-25-epic-manage-todos-security.md, #27) whose single step prints an `::error::` saying rollback runs only from `main` and to choose `main` under "Use workflow from", then exits 1. It reads no secret, needs no job and is needed by none, so nothing deploys and every other run (push on any branch, schedule, dispatch from `main`) is unchanged.

</intent-contract>

## Tasks & Acceptance

- `.github/workflows/ci.yml` -- new job `dispatch-off-main` (no `needs`, `permissions: {}`, no checkout, no secrets); its step's `::error::` names the branch it was started from (workflow-command characters escaped) and appends the same text to the step summary; the header comment's Rollback line says what happens off `main`. No other job or step changes.
- `scripts/ci-workflow-steps.test.ts` -- extend the existing harness: the job graph includes the new job (runs only for a dispatch off `main`: a branch and a tag; never for push, schedule or a dispatch from `main`), it has no `needs`, no other job needs it, its block references no `secrets.`/`vars.`/`ssh`; the step script, run with `bash -e`, exits non-zero with the `::error::` text and the summary.
- `README.md` -- `## Roll back` only: a run started from another branch fails with that error and deploys nothing; run it again from `main`.

**Acceptance Criteria:**
- Given a `workflow_dispatch` run from a branch other than `main` (or a tag), when it runs, then `dispatch-off-main` fails with `::error::` telling the person rollback runs only from `main` and to choose `main` under "Use workflow from", and no other job runs.
- Given a `workflow_dispatch` run from `main`, a push on any branch, or a schedule, when it runs, then `dispatch-off-main` is skipped and the other jobs run exactly as on the baseline (the job-graph test's existing scenarios unchanged).
- Given the scheduled `catch-up`/`catch-up-gate`, when a dispatch run off `main` exists (queued or finished), then neither counts it: both read only `head_branch == 'main'` dispatch runs (existing tests "a run by hand on another branch does not block" / "does not count" stay green).
- Given the branch's CI, when it runs, then actionlint is clean and `pnpm test` passes.

## Implementation Notes

- Oneshot: about 70 changed lines in three files, one new job with a two-line step, plus tests in the existing harness and a README paragraph.
- Implementation of 2026-11-25: `ci.yml` gains job `dispatch-off-main` first under `jobs:` (`permissions: {}`, `timeout-minutes: 5`, no checkout) with step "Refuse a rollback started off main": `::error title=Rollback not run::Rollback runs only from main, and this run was started from <GITHUB_REF_NAME>, so nothing was deployed. Run the workflow again and choose main under "Use workflow from".`, the same text in the step summary, exit 1. `%` in the ref name is escaped to `%25` so a branch name cannot forge the command's encoding. The header comment's Rollback line names it. No other job or step changed.
- `scripts/ci-workflow-steps.test.ts`: the job graph evaluates the new job in every scenario (false for push, branch push, schedule and dispatch from `main`; true for dispatch from `x`, `main-old` and tag `refs/tags/main`, with every other job skipped); the step is run with `bash -e` (exit 1, exact `::error::` line, summary, `%` escape); the job reads no secret, variable or host and no job needs it.
- The catch-up and gate read only dispatch runs with `head_branch == 'main'` (scripts/deploy-catch-up.mjs, both queries); the existing tests "a run by hand on another branch does not block" (gate) and "a dispatch on another branch does not count" / "still going does not count" (catch-up) cover a dispatch off `main`, so no script change.
- Known limit, in README: a branch cut before this job existed carries the old ci.yml, and a dispatch from it still skips every job silently; GitHub runs the workflow file of the chosen ref.
- Verification: `pnpm test` 745 passed; `pnpm typecheck` clean; actionlint 1.7.12 with shellcheck (uvx) exit 0, no output. Mutations: dropping `github.ref != 'refs/heads/main'` from the job's `if:`, or `exit 1` from its step, each fails a test. No todo-test stack used.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) A dispatch from a tag named `main` gets `head_branch: 'main'`, so `scripts/deploy-catch-up.mjs` (catch-up row 6 and the gate, both filtering `head_branch === 'main'`) counts it as a rollback on main, against the new README sentence "Such a run is not on `main`, so the scheduled catch-up ignores it". — Verified by reading both queries; the scripts' behaviour predates this change and errs towards not deploying (safe); the repo has no tags. Patched the README sentence to the true rule: the catch-up counts only runs by hand on `main`, and a tag named `main` would count, so do not create one. No script change (pre-existing, unlikely, safe).
  - `[low]` `[patch]` (quick) The `%`→`%25` escape was applied to the reason used for both the `::error::` and the step summary, so the summary showed `a%250Ab` for branch `a%0Ab`. — Verified. Patched: only the `::error::` data is escaped (`data=${reason//'%'/'%25'}`), the summary prints the reason as is; the test now checks both. Mutation (no escape) fails it.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, including `scripts/ci-workflow-steps.test.ts`.
- `pnpm typecheck` -- expected: pass.
- `uvx --from actionlint-py actionlint -shellcheck "$(uvx --from shellcheck-py which shellcheck)" .github/workflows/ci.yml` -- expected: no output, exit 0 (else CI's pinned actionlint step).
- `git diff <baseline> -- .github/workflows/ci.yml` -- expected: only the new job and the header comment.

**Manual checks (if no CLI):**
- After merge: `gh workflow run ci.yml --ref <any non-main branch> -f sha=<any>`; the run fails in `dispatch-off-main` with the error, and `deploy` shows skipped.

## Auto Run Result

Status: built

**Summary.** A run of CI by hand (`workflow_dispatch`) started from a branch other than `main`, or a tag, now fails visibly: new job `dispatch-off-main` (`if: github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'`) prints `::error title=Rollback not run::Rollback runs only from main, and this run was started from <ref>, so nothing was deployed. Run the workflow again and choose main under "Use workflow from".`, writes the same to the step summary and exits 1. It needs no job, no job needs it, it has `permissions: {}` and reads no secret, variable or host; every other job's `if:`/`needs:` and every deploy step are unchanged, so nothing deploys from it and push, schedule and rollback from `main` behave as before.

**Files changed**
- `.github/workflows/ci.yml` -- the `dispatch-off-main` job and one header-comment line.
- `scripts/ci-workflow-steps.test.ts` -- the job graph evaluates the new job in all 13 scenarios (3 new: dispatch from `x`, `main-old`, tag `main`); the step run with `bash -e` (exit 1, exact error, summary, `%` escape); isolation (no needs either way, no secrets, vars, ssh or docker).
- `README.md` -- Roll back only: what a run off `main` does, how the catch-up treats it, and the limit for branches cut before this job.

**Review findings.** Quick lens: 2 findings, both low, both patched (README wording on tag `main`; escape only in the `::error::`). Deferred: none. Rejected: none.

**Follow-up review: false.** Patched 0 high and 0 medium entries (2 low).

**Verification.** `pnpm test` 745 passed; `pnpm typecheck` clean; actionlint 1.7.12 with shellcheck (uvx) exit 0, no output. Mutations: dropping the job's ref check, its `exit 1`, or the `%` escape each fails a test. The existing tests "a run by hand on another branch does not block" (gate) and "a dispatch on another branch does not count" (catch-up) cover the catch-up side. No todo-test stack used; the lock was never taken.

**Residual risks.**
- The job's real run is only seen on GitHub after merge: dispatch from any branch carrying this ci.yml and see it fail in `dispatch-off-main` with `deploy` skipped.
- A branch cut before this job existed carries the old ci.yml, and a dispatch from it still skips every job silently (README says so).
- A tag named `main` would be counted by the catch-up as a run on `main` (pre-existing, safe: it only delays a catch-up deploy).
