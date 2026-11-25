---
title: 'A storage failure on list or create reports an internal error, not unavailable'
type: bugfix
ticket: '10'
created: '2026-11-25'
status: built
baseline_revision: 'ab75e890531ffed47b2a04d321ba6e5612f67a83'
route: full
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

**Problem:** When storage cannot be reached or refuses writes, `GET /api/health` answers `503 unavailable` but `GET /api/todos` and `POST /api/todos` answer `500 internal`, because only the health route turns storage errors into `UnavailableError`; on list and create they reach the error handler as unhandled errors.

**Approach:** The repository (the only layer that touches Drizzle/SQLite, AD-10) wraps each list/findById/create database call and rethrows a storage failure as `UnavailableError` (with the driver error as `cause`), which the existing error handler already answers with `503 unavailable` and logs at `warn`. Errors that do not come from the database driver (e.g. row mapping, service logic) are rethrown unchanged and still answer `500 internal`.

## Boundaries & Constraints

**Always:** A storage failure is exactly: an error thrown by a database call while the connection is not open (`db.$client.open === false`, better-sqlite3 throws `TypeError: The database connection is not open`), or any `SqliteError` (better-sqlite3's `Database.SqliteError`, e.g. `SQLITE_READONLY`). Only the database call itself is wrapped, never `toTodo`, so a mapping error stays `internal`. The `UnavailableError` message is fixed text and its `cause` is the driver error, which carries no todo text (verified: the sync better-sqlite3 path throws driver errors directly, never Drizzle's `DrizzleQueryError` with params). Integration tests are titled with their scenario id (I7, I9) and cause failures only in-process through the harness (AD-20).

**Never:** Change `apps/api/src/routes/health.ts`, `/api/health` responses (I7), `apps/api/src/problems.ts`'s problem bodies, the `validation`/`conflict` responses of create, `openapi.json`, or anything under `apps/web`. No test-only routes or flags in app code (AD-20). Do not wrap `ping()` (health wraps it already). Harness changes, if any, must be additive only (ticket #35 also edits `apps/api/test/integration/harness.ts`); the plan needs none.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List, connection closed | `harness.db.$client.close()`; `GET /api/todos` | `503`, body deep-equal to `/api/health`'s 503 body in the same state, valid per `openapi.json` | `UnavailableError` -> `warn` log |
| Create, connection closed | connection closed; valid `POST /api/todos` | `503 unavailable`, valid per `openapi.json` | same |
| Create, writes refused | `harness.db.$client.pragma('query_only = ON')`; valid `POST /api/todos` | `503 unavailable`, valid per `openapi.json`; after `query_only = OFF`, `GET /api/todos` does not hold the todo | `SqliteError SQLITE_READONLY` -> `UnavailableError` |
| List, non-storage error | a row inserted via `harness.db` with `createdAt: 8.64e15 + 1` (Invalid Date -> `RangeError` in `toTodo`); `GET /api/todos` | `500 internal`, valid per `openapi.json` | unchanged: `error` log |
| Create, non-storage error | same bad row with id X; `POST /api/todos` with id X | `500 internal`, valid per `openapi.json` | unchanged |
| Storage healthy | normal list/create | unchanged (`200`/`201`/`200` replay/`409`/`400`) | none |

</intent-contract>

## Code Map

- `apps/api/src/todos/repository.ts` -- `createTodoRepository(db, now)`: `list()`, `findById()`, `create()` call Drizzle then map rows with `toTodo`. Add the storage-failure wrapping here around the Drizzle call only. `ping()` stays as is.
- `apps/api/src/errors.ts` -- `UnavailableError` already exists (domain error, no HTTP). Reuse; add no new error class unless needed.
- `apps/api/src/problems.ts:95-104` -- `problemErrorHandler`: `UnavailableError` -> `request.log.warn({ err }, 'service unavailable')` + `PROBLEMS.unavailable`; anything else -> `error` log + `internal`. Read-only for this change. Pino's `err` serializer appends `cause` messages, so the cause must hold no todo text.
- `apps/api/src/routes/health.ts:26-30` -- reference pattern (`throw new UnavailableError('storage is unreachable', { cause })`). Do not modify.
- `apps/api/src/db/client.ts` -- `Db` type exposes `$client: Database.Database` (`open` getter). `import Database from 'better-sqlite3'` gives `Database.SqliteError`.
- `apps/api/test/integration/harness.ts` -- `startHarness()` returns `{ app, db, close }`; `close()` tolerates an already-closed `db.$client`. Do not modify.
- `apps/api/test/integration/health.test.ts` -- the `'GET /api/health with storage unreachable'` describe holds the test `'I9 answers a storage failure on list with a 500 internal problem...'`, which asserts the bug. Replace it.
- `apps/api/test/openapi-schema.ts` -- `expectDocumented(path, method, status, contentType, body)` validates against `openapi.json` (I9).
- `apps/api/test/integration/todos.test.ts` -- style reference (`post`, `expectNothingLeaked` helpers); leave unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/todos/repository.ts` -- add a small private helper that runs a database call and, when it throws a storage failure (per Always), throws `new UnavailableError('storage failed', { cause })`; otherwise rethrows the original error. Apply it to the Drizzle call in `list`, `findById` and `create`, keeping `toTodo` outside it. Update the `TodoRepository` doc comments to say these throw `UnavailableError` on a storage failure. -- list and create report storage failures as unavailable (AD-9) without touching routes, service or the error handler (AD-10).
- [x] `apps/api/test/integration/health.test.ts` -- in the storage-unreachable describe, replace the old list test with `I7 answers a storage failure on list with the same 503 unavailable problem as health` (fetch `/api/health` and `/api/todos` in that state, assert list is `503`, its body deep-equals health's body, `expectDocumented('/api/todos','get',503,...)`, and no stack/SQL in the body) and add `I7 answers a storage failure on create with a 503 unavailable problem` (valid POST; `503`, unavailable body, `expectDocumented('/api/todos','post',503,...)`). -- criteria 1, 2.
- [x] `apps/api/test/integration/storage.test.ts` (new, own harness, `beforeEach` empties `todos`) -- (a) `I9 answers a create that storage refuses to write with 503 unavailable, and stores nothing`: set `query_only = ON`, POST a valid todo, assert 503 unavailable + documented, then in a `finally` set `query_only = OFF`, then `GET /api/todos` does not contain the id; (b) `I9 answers a list that fails outside storage with a 500 internal problem`; (c) `I9 answers a create that fails outside storage with a 500 internal problem` (both using a row with `createdAt: 8.64e15 + 1` inserted through `harness.db`); (d) a check that the `UnavailableError` thrown by `createTodoRepository(harness.db).create(...)` under `query_only` has a message and `cause` message/stack that do not contain the submitted description. -- criteria 2, 3, 4.

**Acceptance Criteria:**
- Given the integration suite on the baseline code, when the new/replaced storage-failure tests for list and create (closed and read-only) run, then they fail; on the fix they pass. Criterion 3's tests pass on both, guarding against an over-broad fix.
- Given the fix, when `pnpm test` and `pnpm typecheck` run, then both succeed with every pre-existing test (health I7 200/503, create validation/conflict) unchanged and green.
- Given the fix, when `git diff ab75e890531ffed47b2a04d321ba6e5612f67a83 --stat` is read, then it touches no file under `apps/web`, no `openapi.json`, and neither `health.ts` nor `problems.ts`.

## Implementation Notes

**Files touched:**
- `apps/api/src/todos/repository.ts` -- private `fromStorage(db, query)` helper (shape as in Design Notes): `Database.SqliteError` or `!db.$client.open` -> `new UnavailableError('storage failed', { cause })`, else rethrow unchanged. Wraps only the Drizzle call in `list`, `findById`, `create`; `toTodo` stays outside, `ping()` untouched. `TodoRepository` doc comments for the three methods now say they throw `UnavailableError` on a storage failure.
- `apps/api/test/integration/health.test.ts` -- replaced the old `I9 ... 500 internal` list test with `I7 answers a storage failure on list with the same 503 unavailable problem as health` (also asserts health is 503 in that state, so the deep-equal is not vacuous) and added `I7 answers a storage failure on create with a 503 unavailable problem` (also asserts the description and stack/SQL are absent from the body). Added the `randomUUID` import.
- `apps/api/test/integration/storage.test.ts` (new) -- own harness, `beforeEach` empties `todos`; the four I9 tests (a)-(d) from the plan. Helpers: `withWritesRefused` (sets `query_only = ON`, resets `OFF` in `finally`), `insertUnmappableRow` (`createdAt: 8.64e15 + 1` via `harness.db`), `expectProblem` (status, `expectDocumented`, problem shape, no stack/SQL).

**Decisions:**
- In `create`, `now()` is evaluated before the wrapped call, so only the database call itself sits inside `fromStorage` (per Always).
- Test (d) catches the error synchronously inside `withWritesRefused` and checks the `UnavailableError` message, `cause` message and `cause` stack all omit the description.
- No harness change was needed.

**Verification run here:**
- `pnpm vitest run --project integration health.test.ts storage.test.ts` on the fix: 8/8 pass.
- Same run with only `apps/api/src/todos/repository.ts` swapped back to the baseline content (file copy, no git state change, then restored): 4 fail (list closed, create closed, create read-only, cause check (d)), and the two 500-internal guards plus the two pre-existing health tests pass, as criterion 3 requires.
- `pnpm typecheck`: exit 0. `pnpm test`: 17 files, 274 tests, exit 0.
- `git diff ab75e89 --stat`: only `repository.ts` and `health.test.ts` (plus the new untracked `storage.test.ts`); no `apps/web`, `openapi.json`, `health.ts` or `problems.ts`.
- Not run (left to the parent per instructions): the `git stash` baseline step and `pnpm test:all`.

**Surprises:** none. `openapi.json` already documents `503` for both `GET` and `POST /api/todos`.

**Review patches (parent, after the quick review):** the create storage-failure test in `health.test.ts` is now titled `I9 answers a storage failure on create with a 503 unavailable problem` (it never calls `/api/health`), and the cause check in `storage.test.ts` is now `keeps the submitted text out of the unavailable error and its cause`, with no scenario id (it sends no request, so I9 does not fit). `storage.test.ts` therefore holds three I9 tests and one untitled check. This deviates from the titles the Tasks prescribed.

**Parent verification:** `git stash push -- apps/api/src` with the plan's two test files run against the baseline source: 4 failed (list closed, create closed, create read-only, cause check), 4 passed (the two 500-internal guards and the two pre-existing health tests); stash popped. `pnpm test:all` (stack lock held, todo-test torn down after): every step passed, exit 0. After the review patches (titles only): `pnpm typecheck` exit 0, `pnpm test` 17 files / 274 tests pass.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 3, false 1, maybe-false 0
- findings:
  - `[low]` `[patch]` `storage.test.ts`: the cause check is titled I9 (contract validation) though it sends no request and validates nothing against `openapi.json`, so scenario coverage would count it as I9 — fixed: dropped the `I9 ` prefix; no scenario id fits (untitled tests are allowed, as in `logs.profile.test.ts`).
  - `[low]` `[patch]` `health.test.ts`: the create storage-failure test is titled I7 (health) but never calls `/api/health` — fixed: retitled `I9 answers a storage failure on create with a 503 unavailable problem`; it validates the POST 503 against `openapi.json`.
  - `[low]` `[reject]` `repository.ts` `fromStorage`: every `SqliteError`, including a schema error such as "no such table" after a mismatched migration, answers 503 at `warn` instead of 500 at `error` — real but unlikely: migrations run at startup and the server does not start when they fail (startup tests), and the constraint case cannot occur on these routes (Design Notes); narrowing to a list of SQLite codes adds branches for a state not shown to be reachable.
  - `[false]` `[reject]` plan bookkeeping: Tasks checkboxes unticked and the Verification line cites "criterion 5" — the fix is an edit to this build's plan, not a defect in the change; "criterion 5" refers to the ticket's criterion 5, which the Verification line states; checkboxes ticked at finalize.

## Design Notes

Why the repository and not the error handler: classifying `SqliteError`/`TypeError` in `problems.ts` would make the HTTP layer know the driver, and a bare `TypeError` there could be any bug. In the repository the connection state is known (`db.$client.open`), so a `TypeError` counts only when the connection is closed. A `SQLITE_CONSTRAINT` error is also a `SqliteError` and would answer `503`; it cannot occur on these routes (find-then-insert runs synchronously, AD-15, and the schema enforces NOT NULL), so the rule stays simple.

Sketch (shape, not prescription):

```ts
function fromStorage<T>(db: Db, query: () => T): T {
  try { return query(); }
  catch (cause) {
    if (cause instanceof Database.SqliteError || !db.$client.open) throw new UnavailableError('storage failed', { cause });
    throw cause;
  }
}
```

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0
- `pnpm test` -- expected: exit 0; the integration project runs `health.test.ts` and `storage.test.ts` with the new I7/I9 titles passing
- `git stash -- apps/api/src && pnpm vitest run --project integration apps/api/test/integration/health.test.ts apps/api/test/integration/storage.test.ts; git stash pop` -- expected: the list/create 503 tests fail on the baseline source (criterion 5), then pop restores the fix
- `pnpm test:all` (holding the shared `todo-test` stack lock) -- expected: exit 0

## Auto Run Result

**Status:** built

**Summary:** `GET /api/todos` and `POST /api/todos` now answer a storage failure (connection closed, or writes refused) with the same `503 unavailable` problem `/api/health` returns, logged at `warn` by the existing error handler. The repository wraps only its database calls: a `SqliteError`, or any error while the connection is closed, becomes `UnavailableError` with the driver error as `cause` (no todo text: the sync better-sqlite3 path never throws Drizzle's params-carrying `DrizzleQueryError`). Errors from outside storage (e.g. row mapping) still answer `500 internal`.

**Files changed:**
- `apps/api/src/todos/repository.ts` -- `fromStorage` helper around the Drizzle calls in `list`, `findById`, `create`.
- `apps/api/test/integration/health.test.ts` -- the old test asserting the bug (list 500) replaced by list 503 = health's 503 (I7) and create 503 (I9).
- `apps/api/test/integration/storage.test.ts` (new) -- read-only create 503 storing nothing, list/create 500 for non-storage errors, and the cause holds no todo text.

**Review (quick):** 4 findings. Patches applied: 2 (both low, test titles). Deferred: none. Rejected: 2 -- any-`SqliteError`-is-unavailable (low, unlikely, fix adds branches); plan bookkeeping (false, plan-only edit).

**Follow-up review recommended:** false (no high, fewer than two medium patched; patched counts: high 0, medium 0, low 2).

**Verification:** `pnpm typecheck` exit 0; `pnpm test` 17 files / 274 tests pass; baseline source with the new tests: 4 fail / 4 pass as expected (criterion 5; criterion 3's guards pass on both by design, since criterion 3 keeps the old behaviour); `pnpm test:all` exit 0 (all steps passed, before the title-only patches).

**Residual risks:** a `SQLITE_ERROR` schema/programming error on list or create would answer `503` at `warn` instead of `500` at `error` (see rejected finding). Ticket #35 proves no failed-create log line holds todo text.
