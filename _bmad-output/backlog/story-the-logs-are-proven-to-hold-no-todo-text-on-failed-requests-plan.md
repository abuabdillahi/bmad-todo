---
title: 'The logs are proven to hold no todo text on failed requests too'
type: chore
ticket: '13'
created: '2026-11-25'
status: built
baseline_revision: 'ab75e890531ffed47b2a04d321ba6e5612f67a83'
route: oneshot
route_source: auto
risk: low
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/backlog/story-the-logs-are-proven-to-hold-no-todo-text-on-failed-requests.md']
warnings: []
deferred:
  - summary: >-
      The scenario catalogue has no id for "no log line holds todo text" (AD-17, AD-19), so the new log tests borrow I2, I10 and I7, and coverage/scenarios.md counts them under those behaviours, I7's health among them.
    evidence: |-
      test-strategy.md lists I1-I11 and none covers logs. The existing logs.profile.test.ts title carries no id at all, so the gap is older than this change. scripts/scenario-coverage.mjs groups results by leading id, so the storage-failure log test is counted as I7 (health) coverage. The fix is a test-strategy decision: add a catalogue entry for logs, then retag logs.test.ts and logs.profile.test.ts with it.
    location: >-
      apps/api/test/integration/logs.test.ts:103
    severity: low
---

<intent-contract>

## Intent

**Problem:** AD-19 says the API's logs never hold todo text, but only the success path (create and list) is tested. Refused creates (validation, conflict) and a create that fails on the server, which logs its error object, are unproven.

**Approach:** One new integration test file, `apps/api/test/integration/logs.test.ts`, starts the real API process (`node apps/api/src/server.ts`, as `startup.test.ts` does) with `LOG_LEVEL=info`, the level the test and prod profiles run at, on a temp SQLite file and a free port. It captures everything the process writes to stdout and stderr, the same streams the `api` container's json-file driver records. Three cases send a create whose description carries a unique marker (a fresh UUID) and then check that no captured line contains it:
- `I2`: a description over 200 characters, refused with `400`.
- `I10`: a stored todo's id reused with a different description, refused with `409`.
- `I7`: storage that refuses the write. A second SQLite connection in the test holds `BEGIN EXCLUSIVE` on the same file. In WAL mode the API's lookup still reads, so its insert, which carries the description, fails with `SQLITE_BUSY` after better-sqlite3's 5 s busy timeout. The test checks that the response is not 2xx, never the exact status (#32 changes `500` to `503`), and that a log line with an `err` was written for the failure, so the error-logging path really ran.

No app code, response, log format or shared helper (`harness.ts`, `stack.ts`) changes. If a case finds a leak, fix the log line so AD-19 holds and name the line here (requirement 4).

</intent-contract>

## Implementation Notes

Oneshot: one test file of about 100 lines, with no app change expected.

Decisions made in planning:
- **Where the cases run (the ticket's open question):** the real API process in the `integration` layer, not the container. The in-process harness cannot capture logs: pino writes straight to fd 1, and `buildApp` takes no log stream, and adding one would be a test-only switch in app code (AD-20). In the container, failing storage would need a lock held through `docker compose exec`. A spawned `server.ts` is the same entrypoint, config and logger the container runs, it runs in `pnpm test` and CI without the stack, and `startup.test.ts` is the precedent.
- **Storage failure:** a write lock held by a second connection (`SQLITE_BUSY`) is a real way storage refuses a write. It makes the insert itself fail. A closed handle (I7's harness case) fails the lookup first, which carries only the id, and can't be done across processes anyway.
- **Scenario ids:** the catalogue has no log scenario, so each title takes the id of the create behaviour it drives: `I2` (invalid create), `I10` (conflict), `I7` (storage unreachable, R15 "health and logs").
- **Probe before planning:** the three cases were run by hand against the code at `ab75e89`. None leaked. drizzle's better-sqlite3 driver throws the bare `SqliteError` (`database is locked`, code `SQLITE_BUSY`), not a `DrizzleQueryError` holding the bound params, and pino logs only its type, message, stack and code. So no logging fix is expected, and requirement 4 does not apply unless the test finds otherwise.

Implementation:
- Added `apps/api/test/integration/logs.test.ts` (the only file touched besides this plan). It finds a free port, spawns `server.ts` with `APP_ENV=test`, `LOG_LEVEL=info` and a temp `DATABASE_PATH`, and waits for `Server listening`. Each create waits for its `request completed` line before the test checks every captured line, so a line pino has not flushed yet can't slip past.
- The `I7` case also checks that a line with an `err` was logged during the failing request. This proves the case reached the error-logging path, whether that path is `unhandled error` today or #32's `service unavailable` at `warn`.
- Result: no line leaked in any case, so no logging fix was needed and no log line is named under requirement 4.
- Mutation check: adding `body: request.body` to the `unhandled error` log failed `I7` only. Logging the body at the top of the error handler failed all three. Both changes were reverted.
- Surprise: the `I7` case takes about 5.2 s, because better-sqlite3's busy timeout is fixed in app code. The test allows 20 s.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 4, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` The titles' scenario ids are borrowed: I7 is the health scenario, and I2 and I10 describe other create behaviours, so coverage/scenarios.md counts the log checks under them. — Real, but the root cause is older than this change: the catalogue has no log scenario, and the existing profile log test has no id. Requirement 5 only asks for "a scenario id". Deferred to a test-strategy decision: a new catalogue entry, then retagging both log tests.
  - `[low]` `[reject]` `afterAll` dereferences `server` and `dir` without a guard, and the spawned child has no `'error'` listener, unlike `startup.test.ts`. — This only matters when `mkdtempSync`, `freePort` or the spawn of `process.execPath` itself fails, which is unlikely in everyday runs. The test would still fail in that case, with an extra error on top. The fix adds guards for a state never shown to happen.
  - `[low]` `[reject]` In I7, a non-JSON line captured during the request throws a bare `SyntaxError` instead of an assertion naming the line. — The test still fails, and correctly, since AD-17 requires JSON lines. pino writes only JSON at Node 26.13.1, so this is unlikely, and the fix adds a try/catch branch.
  - `[low]` `[reject]` The Implementation Notes say the 5 s busy timeout is "fixed in app code", but it is better-sqlite3's default: `client.ts` sets no `timeout`. — The claim is right, but its fix edits this build's plan. The correct fact is recorded under Auto Run Result, and the test's comment already states it correctly.

## Verification

**Commands:**
- `pnpm exec vitest run --project integration apps/api/test/integration/logs.test.ts` -- expected: the three new tests pass.
- `pnpm test` and `pnpm typecheck` -- expected: all pass.
- `pnpm test:all` (with the shared stack lock held) -- expected: passes, including the existing profile log test.

**Manual checks (if no CLI):**
- Temporarily put the marker into a log line, for example `request.log.error({ err: error, body: request.body }, ...)` in `problems.ts`, and confirm the `I7` case fails. Then revert it.

## Auto Run Result

- **Summary:** I added an integration test that starts the real API process (`server.ts`, `LOG_LEVEL=info`) and captures its stdout and stderr. It proves that no logged line holds a create's description in three cases:
  - a create refused for validation (`400`);
  - a create refused as a conflict (`409`);
  - a create that fails because another connection holds the SQLite write lock (`SQLITE_BUSY`). Here the test asserts only that the status is not 2xx, and that an `err` line was logged.

  No case leaked, so no logging fix was needed. No app code, response, log format or shared helper changed.
- **Files changed:**
  - `apps/api/test/integration/logs.test.ts`: the three new tests `I2`, `I10` and `I7`.
  - This plan.
- **Review (quick):** 4 findings, all low.
  - 0 patched.
  - 1 deferred: the catalogue has no log scenario id, so the tests borrow I2, I10 and I7.
  - 3 rejected:
    - the missing `afterAll` and spawn-error guards: unlikely, and the fix adds guards for a state never shown to happen;
    - the unwrapped `JSON.parse`: the test still fails correctly, and the fix adds a branch;
    - the plan's wording about the busy timeout: its fix would edit the plan. For the record, the 5 s is better-sqlite3's default `timeout`. `apps/api/src/db/client.ts` does not set it.
- **Follow-up review recommended:** false. Nothing was patched.
- **Verification:**
  - the new test file: 3/3 passed;
  - `pnpm test`: 272 tests passed;
  - `pnpm typecheck`: passed;
  - `pnpm test:all`: every step passed, including `logs.profile.test.ts`, and `todo-test` was torn down after.
  - Mutation checks: logging `request.body` in the `unhandled error` line failed `I7`, and logging it at the top of the error handler failed all three. Both were reverted.
- **Residual risks:**
  - The `I7` case takes about 5.2 s, the busy-timeout wait.
  - After #32 merges, its `warn` log for the storage failure is covered by the same test, as long as it logs an `err`.
