---
title: 'A burst of merges can leave the tip of main undeployed'
type: bugfix
ticket: '15'
created: '2026-11-25'
status: draft
baseline_revision: ''
route: full
route_source: auto
risk: high
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
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

- `.github/workflows/ci.yml` -- the one workflow (AD-18). `test` job `if: github.event_name == 'push'`; `deploy` job `needs: test`, `if: !cancelled() && ref main && (dispatch || needs.test.result == 'success')`, `concurrency: deploy-prod`, steps "Set up SSH to the host" (secrets → `~/.ssh/config` host `prod-host`), "Skip if a newer SHA is already deployed" (`id: guard`, `docker ps --filter label=com.docker.compose.project=todo --filter label=com.docker.compose.service=api --format '{{.Image}}'`, `deployed=${image##*:}`), "Download the tested images" and "Push the tested images to GHCR" gated on `github.event_name == 'push'`, "Start production". `test` saves/uploads images only on `refs/heads/main` (true for schedule). Do not change any other step's commands.
- `vitest.config.ts` -- `unit` project include; add `scripts/**/*.test.ts`.
- `scripts/` -- plain Node ESM `.mjs` tools (`scenario-coverage.mjs` style: header comment, node builtins only). Tests use Vitest globals (`describe`, `it`, `expect`); a title without a leading scenario id lists as `(no id)` in `coverage/scenarios.md`, which is fine.
- `README.md` -- `## Deploy` and `## Roll back` only.
- `.nvmrc` -- Node 26.13.1, for `actions/setup-node` in `catch-up`.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/deploy-catch-up.mjs` -- new. Export pure `summariseRun(run, jobs)` (outcome: `in-progress` | `red` | `deployed` | `deploy-failed` | `cancelled` | `not-attempted`, per the matrix; "deployed" needs the deploy job's step named `Start production` to have succeeded), pure `decide(facts)` → `{ deploy, level, reason }` in the matrix's order, `gatherFacts({ tip, deployed, runId, git, api })` (git: is-commit, is-ancestor, committer date; api: GET JSON) and `main(env, deps)` that writes `deploy=true|false` and `deployed=<validated SHA or empty>` to `$GITHUB_OUTPUT`, prints `::notice::`/`::warning::` with the reason, appends it to `$GITHUB_STEP_SUMMARY`, and throws on any API error. Real deps use `git` via `execFileSync` and `fetch` on `$GITHUB_API_URL` with `$GH_TOKEN`; runs listed from `/repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs` (`head_sha=T`; and `event=workflow_dispatch&branch=main&status=success`), jobs from `/actions/runs/{id}/jobs` (latest attempt). Excludes the current run (`$GITHUB_RUN_ID`). Runs as a CLI only when executed directly.
- [ ] `scripts/deploy-catch-up.test.ts` -- new. Table tests of `decide` and `summariseRun` for every matrix row, `gatherFacts` with fake git/api (current run excluded, dispatch runs not counted as tip runs, reference time from earliest push run else committer date), and `main` with fakes as a dry run (output lines, notice text, throws on API error).
- [ ] `vitest.config.ts` -- add the scripts test glob to `unit`, so `pnpm test` runs it.
- [ ] `.github/workflows/ci.yml` -- add `schedule: cron '17,47 * * * *'`; new `catch-up` job (`if: github.event_name == 'schedule'`, permissions `contents: read`, `actions: read`, checkout `fetch-depth: 0`, setup-node `.nvmrc`, an SSH step needing only `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, a read step with `set -o pipefail` reusing the guard's `docker ps`, then the script with `GH_TOKEN: ${{ github.token }}`; outputs `deploy`, `deployed`); `test` gets `needs: catch-up` and `if: !cancelled() && (push || needs.catch-up.outputs.deploy == 'true')`; `deploy` gets `needs: [catch-up, test]`; guard, download and GHCR push steps run for `push` or `schedule`; the guard also skips, on schedule only, when the live SHA differs from `needs.catch-up.outputs.deployed`. Add an actionlint step to `test` (Docker image `rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667`). Update the header comment.
- [ ] `README.md` -- Deploy: describe the scheduled catch-up, its no-op cases and where it says so; Roll back: a rollback stays live until the next push to `main` (the catch-up respects it).

**Acceptance Criteria:**
- Given a push to any branch or a `workflow_dispatch` rollback, when the workflow runs, then the same jobs and steps run with the same conditions as at the baseline (the `catch-up` job is skipped).
- Given the branch's CI, when `pnpm test` runs, then the catch-up decision tests pass and actionlint reports no error in `ci.yml`.
- Given the merged workflow on `main`, when a scheduled run finds production on the tip, then the run shows a notice naming T and the `test` and `deploy` jobs are skipped.

## Implementation Notes

- `scripts/deploy-catch-up.mjs`: `gatherFacts` reads the GitHub API only when T is newer than D (equal, older, unrelated and unreadable D decide from git alone), so an API outage cannot fail a no-op check; it fetches jobs only for completed tip runs. `deployed=` is written as D when D is 40-hex and a commit git knows, else empty. Tip runs are not filtered by branch, per the matrix's definition: a branch push of T with a green test and a skipped deploy summarises as `not-attempted`; with a red or cancelled test it counts as T's result. The API wrapper is scoped to `/repos/$GITHUB_REPOSITORY`. A raw image tag is printed only after replacing anything outside `[A-Za-z0-9_.-]`, so it cannot inject a workflow command. Errors print `::error title=Deploy catch-up::…` and exit 1.
- `ci.yml`: the catch-up's read step uses `| sed -n 1p` rather than the guard's `| head -n 1`, so `set -o pipefail` cannot fail on SIGPIPE when `docker ps` prints more than one line. The guard reads `needs.catch-up.outputs.deployed` as `CHECKED`; with an SSH failure in the guard on schedule, the live SHA is empty, differs from `CHECKED`, and the deploy skips (fail closed). The actionlint step runs first in `test`, right after checkout, so it also runs on every branch push; the image digest was checked against Docker Hub's tag `1.7.12`.
- Verified locally: `pnpm test` (608 pass, 47 in `scripts/deploy-catch-up.test.ts`), `pnpm typecheck`, `actionlint` with shellcheck 0.11.0 (no output, exit 0; a deliberately broken `needs.catchup` reference is reported, so the check is live), and a CLI dry run with fake env and an unreachable API URL (equal, tip older and no container decide without the API; tip newer exits 1 with nothing written to `$GITHUB_OUTPUT`). The scheduled path itself can only be seen on `main` after merge (Manual checks).
- Matrix audit (parent): the Raced and SSH-error rows live in workflow bash, not the script, so `scripts/ci-workflow-steps.test.ts` (11 tests, `unit` project) extracts the guard step and `catch-up`'s read step from `ci.yml` as written and runs them under `bash -e` with a fake `ssh` in a temp git repo: push behaviour unchanged (older live deploys, newer live skips, nothing running deploys, an empty `CHECKED` is inert); on schedule, a live SHA changed since `catch-up` skips; the read step fails on an SSH failure and takes the first of several lines.

## Plan Change Log

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

## Design Notes

Why the run-history rules beyond the agreed design: without them, the catch-up would redeploy the tip within 30 min of every rollback (the ticket forbids changing rollback), and re-run the 45-min `test` job every 30 min on a red tip. The ticket's Given names only a cancelled deploy and a missing run; those are the two outcomes that deploy.

The scheduled `deploy` job can still, as any queued deploy can, replace a pending push deploy in `deploy-prod` (GitHub keeps one pending job per group); the next schedule then catches that tip up, so production converges on the tip. The `catch-up` job is not in `deploy-prod`: a pending job there would itself replace a pending deploy. It reads deploy secrets, so story 2.17 must give it `environment: production` too.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, including `scripts/deploy-catch-up.test.ts`.
- `pnpm typecheck` -- expected: pass.
- `uvx --from actionlint-py actionlint -shellcheck "$(uvx --from shellcheck-py which shellcheck)" .github/workflows/ci.yml` -- expected: no output, exit 0.
- `git diff 32c336542b843fdf53526b1f6bf88eb455fad5d9 -- .github/workflows/ci.yml` -- expected: only the changes listed in the ci.yml task.

**Manual checks (if no CLI):**
- After merge, the first scheduled run on `main` (Actions › CI, event `schedule`) shows the `catch-up` job's notice and, with production on the tip, `test` and `deploy` skipped.

## Auto Run Result

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
