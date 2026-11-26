---
title: 'The deploy job reads its secrets from a production environment limited to main'
type: feature
ticket: '17'
created: '2026-11-26'
status: built
baseline_revision: 'd26b5823b1031a385f30c88cf8364000e94b9681'
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

**Problem:** The five deploy secrets (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `TUNNEL_TOKEN`) are repository secrets, readable by a workflow change on any branch (security review S10). Two jobs read them: `deploy` and entry 15's scheduled `catch-up` (SSH read of the SHA production runs).

**Approach:** Add `environment: production` to `deploy` and `catch-up` only, and nothing else in `.github/workflows/ci.yml` beyond a header-comment line. Pin it in `scripts/ci-workflow-steps.test.ts`: exactly those two jobs name `production`, no other job reads the five secrets (or reads secrets dynamically), and across every event and ref the job graph never runs a job that names `production` on a ref other than `refs/heads/main` (so a branch push or `dispatch-off-main` is never refused once the user limits the environment to `main`). README's setup section names the environment and its secrets and gives entry 18's steps; it states GitHub's behaviour (the environment is created on first use with no rules, repository secrets stay readable from it, so deploys keep working before the move) and that each run of a job naming it creates a GitHub deployment, so the scheduled no-op `catch-up` adds one every 30 minutes.

</intent-contract>

## Tasks & Acceptance

- `.github/workflows/ci.yml` -- `environment: production` on `catch-up` and `deploy`; header comment says so. No step, `if:`, `needs:`, secret, variable, permission or concurrency changes. (User-authorised 2026-11-25 for this ticket.)
- `scripts/ci-workflow-steps.test.ts` -- environment and secret pinning over every job id found under `jobs:`; property test over events (push, workflow_dispatch on main/branches/tag; schedule on main only, since GitHub runs schedules on the default branch) and catch-up/test/gate outcomes; `dispatch-off-main` names no environment.
- `README.md` -- `### Required GitHub settings`: the five secrets live in environment `production` (deployment branches: `main`), `PUBLIC_HOSTNAME` stays a repository variable; entry 18's steps; auto-creation and repository-secret fallback; deployment entries and the catch-up's noise. Deploy/catch-up prose mentions the environment where it names secrets.
- `docs/quality/2026-11-25-epic-manage-todos-security.md` -- S10's note records entry 17 built (status unchanged until entry 18).

**Acceptance Criteria:**
- Given a push to `main`, a rollback by hand from `main`, or a schedule, when `deploy` (or `catch-up`) runs, then it runs with `environment: production` and reads the same five secrets and `PUBLIC_HOSTNAME` through unchanged steps.
- Given the workflow, when read by the test, then only `catch-up` and `deploy` name `environment: production`, and no other job references any of the five secrets.
- Given any event and ref, when the job graph is evaluated, then no job naming `production` runs off `refs/heads/main`; the 13 existing job-graph scenarios are unchanged.
- Given README's setup section, when read, then it names `production`, its five secrets, the `main` branch rule, and entry 18's four steps.
- Given the branch's CI, when it runs, then actionlint is clean and `pnpm test` passes.

## Implementation Notes

- Oneshot: about 80 changed lines in four files, a declarative key on two jobs plus tests and docs.
- Implementation of 2026-11-26: `ci.yml` gains `environment: production` (string form, after `runs-on`) on `catch-up` and `deploy`, and three header-comment lines; no other line changed. No `url:` and no `deployment: false` (no settings added beyond the ticket's key).
- `scripts/ci-workflow-steps.test.ts`: new describe block reads every job id under `jobs:` (so a later job is checked), pins `environment: production` on exactly `catch-up` and `deploy` and nowhere else in the file, that no other job references any of the five secrets, that deploy reads all five and catch-up its four, no `secrets[`/`toJSON(secrets)`/`secrets: inherit`; 40 job-graph scenarios (push and dispatch on main, story-x, main-old, tag main; schedule on main with every catch-up/deploy/gate outcome; test green and red) assert no job naming production runs off main. `dispatch-off-main`'s isolation test also forbids `environment:`.
- GitHub behaviour checked against docs.github.com (manage environments; workflow syntax): a referenced environment that does not exist is created with no protection rules or secrets; each job run that references an environment creates a deployment object; `deployment: false` exists to use an environment's secrets without one (not used, per the user's instruction). Environment secrets win over repository secrets of the same name (GitHub secrets precedence), so repo secrets keep deploys working before entry 18. README states the deployment noise from the scheduled `catch-up`.
- README step 4 of the move: re-running a push run's `deploy` needs the one-day artifact and uses that run's own workflow file, so after a day the step is a run by hand on `main` with the live SHA.
- `docs/quality/...-security.md`: S10's note records entry 17 built; status left "to be fixed" until entry 18.
- Verification: `pnpm test` 791 passed (28 files); `pnpm typecheck` clean; actionlint (uvx, with shellcheck) exit 0, no output. Mutations, each fails tests: `environment` dropped from deploy (2), added to test (2), deploy's `github.ref == 'refs/heads/main'` dropped (14), `test` reading `secrets.DEPLOY_HOST` (1), catch-up's `if:` widened to any non-push event (11). No todo-test stack used.

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 5 findings — high 0, medium 1, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` (quick) The "no other job reads the five secrets" scan was case-sensitive, but GitHub resolves context properties in any case (`secrets.deploy_host` reads `DEPLOY_HOST`). — Verified. Patched: case-insensitive `secrets\.<NAME>\b` regex; mutation (`test` reading `secrets.deploy_host`) now fails 2 tests.
  - `[low]` `[patch]` (quick) The dynamic-read regex missed `toJson(secrets)` (function names are case-insensitive) and `secrets [`. — Verified. Patched: `/secrets\s*\[|tojson\(\s*secrets|secrets:\s*inherit/i`; mutation (`toJson(secrets)` in `test`) fails.
  - `[low]` `[patch]` (quick) The per-job scan never looked at the workflow-level `env:`, which every job inherits. — Verified (`jobIds()`/`jobBlock()` cover only `jobs:`). Patched: new test that every `secrets.<deploy secret>` in the whole file sits inside `catch-up` or `deploy`; mutation (top-level `K: ${{ secrets.DEPLOY_SSH_KEY }}`) fails.
  - `[medium]` `[patch]` (quick) README entry-18 step 4 said to re-run "the last main deploy"'s push run; with a rollback live, that push's SHA is newer and the guard would redeploy it, undoing the rollback. — Verified against the guard (`git merge-base --is-ancestor "$SHA" "$deployed"` skips only an older SHA). Patched: step 4 now re-deploys the SHA production runs now (re-run its push run if under a day old, else a run by hand on `main` with that SHA) and says not to re-run any other SHA's push run.
  - `[low]` `[patch]` (quick) README's One-time bootstrap › Cloudflare bullet still called `TUNNEL_TOKEN` a plain secret. — Verified. Patched: "the `TUNNEL_TOKEN` secret of the `production` environment".

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, including `scripts/ci-workflow-steps.test.ts`.
- `pnpm typecheck` -- expected: pass.
- `uvx --from actionlint-py actionlint -shellcheck "$(uvx --from shellcheck-py which shellcheck)" .github/workflows/ci.yml` -- expected: no output, exit 0.
- `git diff <baseline> -- .github/workflows/ci.yml` -- expected: two `environment: production` lines and the header comment only.

**Manual checks (if no CLI):**
- After merge: the push run's `deploy` shows "production" on its job page and the repo's Environments list shows `production`; the deploy passes its public health check.

## Auto Run Result

Status: built

**Summary.** `deploy` and entry 15's scheduled `catch-up`, the only jobs that read `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS` and `TUNNEL_TOKEN`, now name `environment: production`. No step, `if:`, `needs:`, secret, variable, permission or concurrency changed. Until entry 18 the environment is auto-created with no rules and the jobs keep reading the repository secrets; once it is limited to `main`, no job naming it runs on another ref (pinned over 40 event/ref/outcome scenarios). README documents the environment, its secrets, entry 18's four steps, and that each `deploy` and each half-hourly `catch-up` creates a GitHub deployment.

**Files changed**
- `.github/workflows/ci.yml` -- `environment: production` on `catch-up` and `deploy`; three header-comment lines.
- `scripts/ci-workflow-steps.test.ts` -- environment and secret pinning (every job id, case-insensitive, workflow-level `env:` included, no dynamic or whole-object reads) and the no-production-off-main property over the job graph; `dispatch-off-main` names no environment.
- `README.md` -- Required GitHub settings (environment, table, move steps, branch-rule refusal, Deployments list), deploy/catch-up prose, bootstrap's `TUNNEL_TOKEN` line.
- `docs/quality/2026-11-25-epic-manage-todos-security.md` -- S10 note: entry 17 built.

**Review findings.** Quick lens: 5 findings (1 medium, 4 low), all patched; deferred none; rejected none.

**Follow-up review: false.** Patched 0 high, 1 medium, 4 low entries (first pass: true needs a high or two mediums).

**Verification.** `pnpm test` 792 passed (28 files); `pnpm typecheck` clean; actionlint (uvx, with shellcheck) exit 0, no output. Mutations, each fails tests: environment dropped from deploy / added to test, deploy's main-ref check dropped, catch-up's `if:` widened, `test` reading `secrets.DEPLOY_HOST` or `secrets.deploy_host` or `toJson(secrets)`, a deploy secret in workflow-level `env:`. No todo-test stack used.

**Residual risks.**
- Only seen on GitHub after merge: the merge's push run creates `production` and `deploy` runs in it, reading the repository secrets; check its health check passes and Settings › Environments lists `production`.
- Every scheduled `catch-up` creates a deployment to `production` (48 a day), so the Deployments list is mostly no-op checks; `deployment: false` on `catch-up` would avoid it but was not added (no settings beyond the ticket's key).
- Entry 18 is the user's: until then the secrets stay repository secrets and S10 stays open.
