---
title: 'docker compose without -p uses the production project name'
type: bugfix
ticket: '12'
created: '2026-11-25'
status: built
baseline_revision: '7cd866b1d594ff573ff14b186b5f2455d8a3a5d3'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `compose.yml` has no top-level `name:`, so a `docker compose` command run with no `-p` (and no `COMPOSE_PROJECT_NAME`) in a folder named `todo` falls back to the folder name, `todo`, which is production's project (C7, AD-16). Reproduced on ab75e89: `compose.yml` copied into a scratch folder `…/todo/`, `docker compose config --format json` with `COMPOSE_PROJECT_NAME` unset reports `"name": "todo"`.

**Approach:** Per the ticket's Decision of 2026-11-25 (user), a command with no project name refuses to run: give `compose.yml` a top-level `name: ${COMPOSE_PROJECT_NAME:?<message naming -p todo-dev, -p todo-test and -p todo>}`, so Compose fails at interpolation before it touches any container, while `-p` (from which Compose sets `COMPOSE_PROJECT_NAME`) and an explicit `COMPOSE_PROJECT_NAME` still resolve to exactly that name. A first build defaulted to `name: todo-dev` and was reverted at review (a forgotten `-p` on the host would start a second `cloudflared` over an empty database; a test reset would delete dev data); its saved patch `bug-docker-compose-without-p-uses-the-production-project-name-plan.patch` (in git history at c3d9cbd) holds a reusable `docker compose config` profile test, whose no-`-p` case now expects a refusal and whose child env must also drop `COMPOSE_ENV_FILES` and `COMPOSE_PROFILES`. Every compose command the repository runs (scripts, tests, the workflow) must already pass a project name; `.env.example` and the README change only where they describe the project names or a command with no `-p`.

</intent-contract>

## Implementation Notes

Oneshot: four files, about 70 lines: the `name:` line and its comment in `compose.yml`, the profile test restored from the saved patch with its no-`-p` case changed to expect a refusal, one reworded line in `.env.example`, one README sentence.

Planned changes:
- `compose.yml` -- first key `name: "${COMPOSE_PROJECT_NAME:?…}"`, the message naming `-p todo-dev`, `-p todo-test` and `-p todo`, with a comment saying why. No service, volume or profile changes.
- `apps/api/test/profile/project-name.profile.test.ts` -- new, from the patch (`git show d9dcb48:_bmad-output/backlog/bug-docker-compose-without-p-uses-the-production-project-name-plan.patch`). Copies `compose.yml` into `mkdtemp()/todo/` and runs only `docker compose … config --format json`, with `COMPOSE_PROJECT_NAME`, `COMPOSE_FILE`, `COMPOSE_ENV_FILES` and `COMPOSE_PROFILES` removed from the child env. With no `-p` (with and without `--profile prod`) the command exits non-zero, prints no config, and its stderr names `-p todo-dev`, `-p todo-test` and `-p todo`. Each of `-p todo-dev`/`todo-test`/`todo` with its profile resolves exactly that name, and `COMPOSE_PROJECT_NAME=todo-dev` with no `-p` resolves `todo-dev`. It does not import `stack.ts`, so it needs no running stack. It fails on the baseline `compose.yml`, which resolves `todo` (AC3).
- `.env.example:10-11` -- "todo: production (compose.yml's default)" means `APP_ENV`'s default, but reads as if `todo` were the default project. Reword it to name `APP_ENV`'s default, and say that a command with no `-p` is refused.
- `README.md` "Run" -- one sentence after "Each environment runs under its own compose project name…": a `docker compose` command with no `-p` (and no `COMPOSE_PROJECT_NAME`) is refused, so it can never land on production's `todo`.

Checked at planning, on e40d8eb, with only `docker compose config` from a scratch `…/todo/` (Compose v5.7.1, Engine 29.9.3):
- With the `name:` line: no `-p` → exit 1, "error while interpolating name: required variable COMPOSE_PROJECT_NAME is missing a value: <message>", also with `--profile prod`. `-p todo-dev --profile dev`, `-p todo-test --profile test` and `-p todo --profile prod` → exactly those names, each rendering the same config as the baseline. `COMPOSE_PROJECT_NAME=todo-dev` alone → `todo-dev`.
- Compose 2.24.4 (the README's minimum, for the host too) uses compose-go v2.0.0-rc.3. Its `loader/loader.go` interpolates `name:` only when no name was given imperatively (`projectName()`), and puts the `-p` name into the interpolation env as `COMPOSE_PROJECT_NAME` before loading the model, so the same behaviour holds there. Running a 2.24.4 binary was not allowed in this session; this is from its source.
- Every compose invocation already passes a project name: `.github/workflows/ci.yml:207,214-216` (`-p todo`, the deploy; the test job runs compose only through `pnpm test:all`); `scripts/test-all.mjs:20` (`-p todo-test`); `apps/api/test/profile/stack.ts:23` (`-p $COMPOSE_PROJECT`, default `todo-test`), which every profile test uses. `e2e/` and the `package.json` scripts run no compose. The host `.env` the deploy writes sets no `COMPOSE_PROJECT_NAME`. The deploy needs no change.

Built:
- `compose.yml` -- `name: "${COMPOSE_PROJECT_NAME:?pass a project name: -p todo-dev, -p todo-test or -p todo}"` after the header, with a 3-line comment. Nothing else changed.
- `apps/api/test/profile/project-name.profile.test.ts` -- 7 tests: no `-p` (bare, `--profile prod`, `--profile test`) exits non-zero with empty stdout and stderr naming each `-p`; each `-p` resolves exactly its name; `COMPOSE_PROJECT_NAME=todo-dev` resolves `todo-dev`. Uses `spawnSync` to read the exit status and stderr.
- `.env.example` -- one line under the project list says a command with no `-p` is refused; "compose.yml's default" became "compose.yml's default for APP_ENV".
- `README.md` -- one sentence under "Run".
- Verified: `pnpm typecheck` 0; `pnpm test` 0 (277); the new file 7/7, and 3 failed (the no-`-p` cases) with the `name:` line removed, then restored; `pnpm test:all` 0, every step passed, the 7 tests `pass · profile` in `coverage/scenarios.md`. Stack lock held only for `pnpm test:all` and released; `todo-test` down after.
- Surprise: none. No compose command ran without `-p` except `config` in a scratch `…/todo/`, and none against project `todo` except `config`.

## Plan Change Log

- 2026-11-25, orchestrator: Re-opened from `blocked` as `draft` after the user chose option (a) for the intent gap recorded in this plan's first Review Triage Log (commit c3d9cbd). The Approach is amended to match; the ticket's criteria 1-3 and its Boundaries were amended on main (e40d8eb). The first run's baseline, review and deferred fields are cleared; its two deferred items were written for the `todo-dev` default and no longer apply as written.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 3, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `compose.yml` comment says `-p` "always resolves", but compose-go v2.0.0-rc.3 (Compose 2.24.4) puts the `-p` name into the interpolation env only when `COMPOSE_PROJECT_NAME` is absent, so an exported empty `COMPOSE_PROJECT_NAME` plus `-p` could be refused there. — On Compose v5.7.1, `COMPOSE_PROJECT_NAME= docker compose -p todo-dev config` resolves `todo-dev` (checked); on 2.24.4 it follows from its source, needs an unusual shell, and fails safe (refused before acting). Patched: comment reworded to "Compose sets COMPOSE_PROJECT_NAME from -p, so with -p it resolves to exactly that name"; added the test "-p wins over an empty COMPOSE_PROJECT_NAME inherited from the shell" (passes on the local and CI Compose).
  - `[low]` `[patch]` `_bmad-output/backlog/…-plan.patch` (added in d9dcb48 on this branch) holds the rejected `name: todo-dev` fix and would land on `main` with the merge. — Verified tracked in the tree, not on main. Patched: deleted with `git rm`; it stays in history at d9dcb48.
  - `[low]` `[reject]` The plan cites c3d9cbd, which only `origin/bug-34-compose-project-name` contains and which the branch's force push makes unreachable. — Real (`git branch -a --contains c3d9cbd` lists only that remote branch), but the citations are inside `<intent-contract>` and the append-only Plan Change Log; the fix edits this plan. The same content is at d9dcb48, which the Implementation Notes cite.
  - `[low]` `[reject]` The new test titles carry no scenario id (README: new tests should start with one). — No U/I/K/E id in `test-strategy.md` covers the compose project name, and `headers.profile.test.ts` is an untagged precedent; adding one means changing the test strategy, more than a direct correction, and no developer is hindered.
  - `[low]` `[patch]` The AC3 guard sits in the `profile` project, which runs only when `todo-test` came up, and `vitest.config.ts`'s comment describes `profile` only as checks against the running stack. — AC3 holds (`pnpm test:all` fails anyway when the stack fails). Patched: the `vitest.config.ts` comment now says the compose project-name check needs no stack.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: exit 0.
- `pnpm exec vitest run --project profile apps/api/test/profile/project-name.profile.test.ts` -- expected: passes with the fix; its no-`-p` cases fail when the `name:` line is removed (run once that way to prove AC3, then restore).
- `pnpm test:all` (holding `/tmp/todo-test-stack.lock`) -- expected: exit 0, the new tests listed as passed under `profile` in `coverage/scenarios.md`.
- AC4 (the deploy after the merge, `/api/health` 200) is proven by the deploy job after the merge, outside this build.

## Auto Run Result

- Status: built
- Summary: `compose.yml` now has `name: "${COMPOSE_PROJECT_NAME:?pass a project name: -p todo-dev, -p todo-test or -p todo}"`, so a `docker compose` command with no `-p` and no `COMPOSE_PROJECT_NAME` is refused at interpolation, before it touches any container, and names the `-p` to pass. `-p todo-dev`, `-p todo-test` and `-p todo` resolve exactly those names and render the same config as before; the deploy's commands are unchanged.
- Files changed:
  - `compose.yml` -- the `name:` line and its comment.
  - `apps/api/test/profile/project-name.profile.test.ts` -- new, 8 `docker compose config` checks from a scratch folder named `todo` (refusal with no `-p` ×3, each `-p` ×3, `-p` over an empty `COMPOSE_PROJECT_NAME`, `COMPOSE_PROJECT_NAME` alone).
  - `vitest.config.ts` -- comment: the `profile` project's project-name check needs no stack.
  - `.env.example` -- a line saying a command with no `-p` is refused; "compose.yml's default" now reads "compose.yml's default for APP_ENV".
  - `README.md` -- one sentence under "Run" on the refusal.
  - `_bmad-output/backlog/…-plan.patch` -- deleted (the rejected first attempt; kept in history at d9dcb48).
- Review (quick): 5 findings, all low. Patched 3 (comment over-claim plus a new test; stale `.patch` deleted; `vitest.config.ts` comment). Deferred 0. Rejected 2: the c3d9cbd citations (fix edits this plan; same content at d9dcb48) and the missing scenario ids (no id in `test-strategy.md` fits; existing untagged precedent).
- Follow-up review recommended: false (patched: high 0, medium 0, low 3).
- Verification: `pnpm typecheck` 0; `pnpm test` 0 (277 tests); the new file 8/8, and before the review patches its 3 no-`-p` cases failed with the `name:` line removed (AC3); `pnpm test:all` 0 after the patches, every step passed, the 8 new tests `pass · profile` in `coverage/scenarios.md`. Stack lock held only during each `pnpm test:all` and released; `todo-test` down after.
- Residual risks: Compose 2.24.4 was checked from its compose-go source (v2.0.0-rc.3), not by running it. AC4 (deploy after merge, `/api/health` 200) is proven only by the deploy job after the merge.
