---
title: 'docker compose without -p uses the production project name'
type: bugfix
ticket: '12'
created: '2026-11-25'
status: blocked
baseline_revision: 'ab75e890531ffed47b2a04d321ba6e5612f67a83'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: '.env.example still calls `todo` "compose.yml''s default"; with this fix the default (no -p) is `todo-dev`. Ticket #25 owns .env.example, so the line is left for it.'
    evidence: '.env.example:10-11 reads "todo-dev: development (fixed in compose.yml); todo-test: test (set by `pnpm test:all`); todo: production (compose.yml''s default)."'
    location: '.env.example:11'
    severity: low
  - summary: 'README could say that a command with no -p runs under project todo-dev, never todo (production), and that production commands on the host must still pass -p todo. Ticket #25 owns README.md.'
    evidence: 'Ticket Boundaries: README.md and .env.example are not changed here; a line about running with no -p is recorded as deferred.'
    location: 'README.md (Run it locally / Read the logs)'
    severity: low
---

<intent-contract>

## Intent

**Problem:** `compose.yml` has no top-level `name:`, so a `docker compose` command run with no `-p` (and no `COMPOSE_PROJECT_NAME`) in a folder named `todo` falls back to the folder name, `todo`, which is production's project (C7, AD-16). Reproduced on ab75e89: `compose.yml` copied into a scratch folder `…/todo/`, `docker compose config --format json` with `COMPOSE_PROJECT_NAME` unset reports `"name": "todo"`.

**Approach:** Add a top-level `name: todo-dev` to `compose.yml`, so a command with no project name lands on the dev project, the usual no-flag case and one of AD-16's three names. Compose's precedence is `-p`, then `COMPOSE_PROJECT_NAME`, then `name:`, then the folder name, so `-p todo-dev`, `-p todo-test` and `-p todo` (the deploy, AD-18) are unchanged. Add a check to the `profile` layer, which `pnpm test:all` runs, that reads the resolved project name through `docker compose config` from a scratch folder named `todo`: no project given → not `todo` (it is `todo-dev`); each `-p` → exactly that name.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [ ] `compose.yml` -- add `name: todo-dev` as the first key, with a header comment saying it is the project for a command with no `-p`, never `todo` -- the fix; must not change any service, volume, profile, or the three project names.
- [ ] `apps/api/test/profile/project-name.profile.test.ts` -- new; copies `compose.yml` into `mkdtemp()/todo/`, runs `docker compose config --format json` there with `COMPOSE_PROJECT_NAME` and `COMPOSE_FILE` removed from the env, and asserts the top-level `name`: with no `-p` it is not `todo` and is `todo-dev`; with each of `-p todo-dev`, `-p todo-test`, `-p todo` it is exactly that name. Uses only `config` (read-only, no containers) and does not import `stack.ts`, so it needs no stack. Removes the scratch folder after.

**Acceptance Criteria:**
- Given a folder named `todo` holding `compose.yml`, no `-p` and no `COMPOSE_PROJECT_NAME`, when `docker compose config --format json` runs there, then its `name` is `todo-dev`, not `todo` (ticket AC1).
- Given the same folder, when each of `-p todo-dev`, `-p todo-test`, `-p todo` is passed, then `name` is exactly that project; `pnpm test:all` passes; `.github/workflows/ci.yml` is unchanged (AC2).
- Given the new test, when it runs against the baseline `compose.yml` (no `name:`), then it fails; with the fix it passes (AC3).
- Given the fix merged to `main`, when the deploy job runs, then it succeeds and `/api/health` on the public hostname answers `200` (AC4). Proven after merge by the deploy job, which the orchestrator runs; this build does not block on it.

## Implementation Notes

Oneshot: two files, about 40 lines (one `name:` line and its comment, one small test file).

Why `todo-dev` and not a name that makes Compose refuse to run (`name: ${COMPOSE_PROJECT_NAME:?…}` also works, and `-p` still overrides it): the ticket's AC1 asks that "the project it uses is not `todo`", that is, a command still runs under some project. The Boundaries also keep the three project names, so the plan reuses `todo-dev` and adds no fourth name. Checked on ab75e89 with `docker compose config`: with the `name:` line, `-p todo --profile prod`, `-p todo-test --profile test` and `-p todo-dev --profile dev` render the same config as before, apart from the scratch folder's path.

Built:
- `compose.yml` -- `name: todo-dev` after the header, with a comment on why it is there and that `-p` wins over it. No service, volume or profile changed.
- `apps/api/test/profile/project-name.profile.test.ts` -- 4 tests: no `-p` → `todo-dev`, never `todo`; `-p todo-dev`/`todo-test`/`todo` → exactly that. It drops `COMPOSE_PROJECT_NAME` and `COMPOSE_FILE` from the child env so a developer's shell cannot mask the fallback, and does not import `stack.ts`, so it also runs with no stack up.
- Verified: `pnpm typecheck` 0; `pnpm test` 0 (269 tests); the new file alone passes (4/4) and, against the baseline `compose.yml`, fails its no-`-p` test (1 failed, 3 passed); `pnpm test:all` 0, every step passed, the 4 tests listed as `pass · profile` in `coverage/scenarios.md`.
- Surprise: none in the code. The only folder-name fallback check run was `docker compose config` in a scratch `…/todo/`; no compose command ran against project `todo`.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 2, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[intent_gap]` On the production host, `docker compose --profile prod up -d` with no `-p` in `~/todo` now creates project `todo-dev`: an `api` on a new empty `todo-dev_data` volume, a `web`, and a `cloudflared` started with the real `TUNNEL_TOKEN` from the deploy-written `~/todo/.env` (`.github/workflows/ci.yml:180-192`). `prod` publishes no ports (AD-3), so it all starts, and the second connector joins the same tunnel. Cloudflare can then send public requests to an empty, second database. Production's own containers and volume are untouched (AC1 holds literally), but users are affected. — Verified against `ci.yml` and `compose.yml`. The fix changes the Approach inside `<intent-contract>`, and more than one reading fits, so it is not inferred. Attempted change saved as [bug-docker-compose-without-p-uses-the-production-project-name-plan.patch](bug-docker-compose-without-p-uses-the-production-project-name-plan.patch); code reverted.
  - `[medium]` `[intent_gap]` With no `-p`, `docker compose --profile test down -v` (or any test reset) now resolves to `todo-dev` and deletes `todo-dev_data`, the dev database. AD-16 lists "a test reset wiping dev data" under what the three project names prevent. — Verified: `name: todo-dev` applies to every unnamed command, whatever the profile. Same root cause as the row above (the chosen default), so it shares that row's route.
  - `[low]` `[intent_gap]` `apps/api/test/profile/project-name.profile.test.ts:18-19` removes only `COMPOSE_PROJECT_NAME` and `COMPOSE_FILE` from the child env. `COMPOSE_ENV_FILES` in a developer's shell could name an env file that sets `COMPOSE_PROJECT_NAME` and mask the fallback. — Real, and a trivial fix (also drop `COMPOSE_ENV_FILES` and `COMPOSE_PROFILES`). Moot under this pass's intent_gap: the code is reverted, so apply it with whichever fix is chosen.
  - `[low]` `[reject]` The plan's Execution checkboxes are still `- [ ]` although the Implementation Notes record both tasks as done. — The fix is editing this build's plan, which triage rejects.

Unresolved question (intent gap): what should a `docker compose` command with no `-p` and no `COMPOSE_PROJECT_NAME` do?
- (a) Refuse to run: `name: ${COMPOSE_PROJECT_NAME:?pass -p todo-dev, -p todo-test or -p todo}`. Checked on ab75e89 with `docker compose config`: with no `-p` it fails with "required variable COMPOSE_PROJECT_NAME is missing a value"; with `-p todo --profile prod` it resolves `name: todo`, as Compose sets that variable from `-p`. This fixes both medium findings. But AC1's "the project it uses is not `todo`" reads as if a command still runs, and `docker compose config` or IDE tooling with no `-p` would fail too.
- (b) Run under a fourth, isolated name (for example `todo-default`). This fixes the dev-data finding but not the host's second tunnel connector, and it adds a project name beside AD-16's three.
- (c) Keep `todo-dev` (the saved patch) and accept both medium findings.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: exit 0 (the in-process layers are unaffected).
- `pnpm exec vitest run --project profile apps/api/test/profile/project-name.profile.test.ts` -- expected: passes with the fix; fails when the `name:` line is removed (run once that way to prove AC3, then restore).
- `pnpm test:all` (holding `/tmp/todo-test-stack.lock`) -- expected: exit 0, with the new test listed as passed under `profile` in `coverage/scenarios.md`.

## Auto Run Result

- Status: blocked
- Blocking condition: intent gap. The quick review found that the planned default `name: todo-dev` causes two medium harms (see the Review Triage Log). The fix changes the Approach inside `<intent-contract>`, and more than one fix is defensible: refuse to run with no `-p`, run under an isolated fourth name, or keep `todo-dev`. Answer the question in the Review Triage Log, amend the intent's Approach, and re-run.
- `tickets.py mark` was not used: it exits 2 with "store is github: change status through the store's write verb, not this script". The status was written here instead.
- Attempted change (reverted, kept for reuse): [bug-docker-compose-without-p-uses-the-production-project-name-plan.patch](bug-docker-compose-without-p-uses-the-production-project-name-plan.patch). It adds `name: todo-dev` to `compose.yml` and the 4-test `apps/api/test/profile/project-name.profile.test.ts`. The test fits any fix: change its no-`-p` expectation, and drop `COMPOSE_ENV_FILES`/`COMPOSE_PROFILES` from its env too.
- Verification of the attempted change, before the revert: `pnpm typecheck` 0; `pnpm test` 0 (269); the new test passed 4/4 with the fix and failed its no-`-p` case on the baseline; `pnpm test:all` 0, every step passed.
- Review: quick lens, 4 findings: 2 medium (intent_gap), 1 low (intent_gap, moot), 1 low rejected (its fix edits this plan). No patches applied; nothing new deferred.
- Not done: AC4 (deploy after merge). There is no merge.
- Repository: no code change remains on the branch. Only this plan and the patch are committed.
