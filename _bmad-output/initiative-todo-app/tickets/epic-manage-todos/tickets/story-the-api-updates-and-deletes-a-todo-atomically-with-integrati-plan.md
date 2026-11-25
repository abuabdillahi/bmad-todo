---
title: 'The API updates and deletes a todo, atomically, with integration and contract tests'
type: feature
ticket: '2'
created: '2026-11-25'
status: built
baseline_revision: 'e8b4cade8b38c6ae28d4f35302da7875af417d3d'
route: full
route_source: auto
risk: medium
review: thorough
review_source: pinned
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The API can only list and create todos. Web stories 3, 4 and 5 need `PATCH /api/todos/{id}` and `DELETE /api/todos/{id}` (AD-6), with strict validation, atomic writes and the same problem semantics as list and create. The header and log tests still borrow scenario ids I8, I2, I10 and I7, which test-strategy.md now names I12 and I13.

**Approach:** Add an update body schema to `packages/contract`, one-statement `update` and `remove` methods to the repository, existence rules to the service, and the two routes. Regenerate `openapi.json`. Cover them with integration, storage, log, contract, contract-unavailable and profile tests, and re-tag the borrowed header and log tests to I12 and I13.

## Boundaries & Constraints

**Always:** Each write is one SQL statement (AD-15), and existence comes from that statement's result, not a separate read first. The update body is `{ description?, completed? }`, `additionalProperties: false`, at least one property, `description` trimmed in `preValidation` and then held to the shared `Description` schema (AD-8), the same trim the create route uses. Every non-2xx answer goes through the one error handler, uses an existing problem type (AD-9) and holds no todo text, stack or SQL. A storage failure answers `503 unavailable`. `openapi.json` documents 503 on both new operations and is regenerated with `pnpm gen:openapi` and committed. Test titles lead with their scenario ids.

**Never:** No change to create, list or health behaviour or to their contract (only their re-tagged test titles). No web, e2e or nginx changes. No new problem type, migration, `PUT` or bulk endpoint. No `perf-api.mjs` change (story 9). No test-only switches in app code (AD-20).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Complete | PATCH `{ "completed": true }`, todo exists | 200, full `Todo` with `completed: true`, stored | No error expected |
| Edit text | PATCH `{ "description": "  New  " }` | 200, description `New` stored; other fields unchanged | No error expected |
| Both fields | PATCH `{ description, completed }` | 200, both stored | No error expected |
| Empty / missing body | PATCH `{}`, or no body | 400 validation problem, no `errors` | Todo unchanged |
| Strict body | unknown field, `null`, `completed: "true"`, `description: 123` | 400 validation, `errors` names the field | Todo unchanged, no coercion or stripping |
| Bad description | empty, whitespace-only, 201 code points, or holding `[\p{Cc}  ]` after trimming, even beside a valid `completed` | 400 validation, `errors` names `description` | Nothing changes, never normalised |
| Unknown id | PATCH or DELETE an id with no stored todo, a non-UUID string included | 404 not-found problem | Nothing changes |
| Delete | DELETE an existing id | 204, empty body; a second DELETE or a PATCH answers 404; it is gone from the list | No error expected |
| Storage refuses the write | PATCH or DELETE with SQLite refusing writes | 503 unavailable problem | Row unchanged and still listed |

</intent-contract>

## Code Map

- `packages/contract/src/todo.ts`, `index.ts` -- add and export `UpdateTodoBody` (`Type.Object({ description: Type.Optional(Description), completed: Type.Optional(Type.Boolean()) }, { additionalProperties: false, minProperties: 1 })`) beside `CreateTodoBody`.
- `apps/api/src/todos/repository.ts` -- `fromStorage` maps any storage error to `UnavailableError`. Add `update(id, changes)` (`db.update(todos).set(...).where(eq(todos.id, id)).returning().get()`, setting only the fields given, returning `Todo | undefined`) and `remove(id)` (`db.delete(...).where(...).run().changes > 0`), both inside `fromStorage`.
- `apps/api/src/todos/service.ts` -- add `update(id, changes): Todo` and `remove(id): void`, which throw `NotFoundError` (`apps/api/src/errors.ts`) when the repository reports no row.
- `apps/api/src/routes/todos.ts` -- add `PATCH /todos/:id` (operationId `updateTodo`) and `DELETE /todos/:id` (operationId `deleteTodo`), with params `Type.Object({ id: Type.String() }, { additionalProperties: false })` (no uuid format), and move the POST `preValidation` trim into one shared function used by both. DELETE answers `reply.code(204).send()`.
- `apps/api/src/routes/problem-responses.ts` -- add a 404 entry (`/problems/not-found`).
- `apps/api/src/problems.ts` -- `minProperties` and a non-object body report no field, so they give a validation problem without `errors`. No change expected.
- `packages/contract/openapi.json` -- regenerated, never hand-edited.
- `apps/api/test/openapi-schema.ts` -- `Method` gains `patch` and `delete`. Add a helper that asserts a documented status has no content, for 204.
- `apps/api/test/integration/todos.test.ts` (helpers `post`, `storedRows`, `expectValidationProblem`, `expectNothingLeaked`), `storage.test.ts` (`withWritesRefused`, `insertUnmappableRow`, `expectProblem`), `logs.test.ts` (real process, `BEGIN EXCLUSIVE` lock), `openapi.test.ts` (path and response lists) -- the patterns to follow and the files to extend.
- `apps/api/test/contract/todos.contract.test.ts`, `apps/api/test/unavailable/api-down.contract.test.ts`, `apps/api/test/profile/headers.profile.test.ts`, `logs.profile.test.ts`, `stack.ts` (`call`, `createTodo`) -- stack suites. A route entry needs both the real URL and the documented path template `/api/todos/{id}`.
- `README.md` line 95 -- the logs paragraph lists what the log tests prove.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contract/src/todo.ts`, `index.ts` -- add and export `UpdateTodoBody` -- one schema source (AD-5).
- [x] `apps/api/src/todos/repository.ts`, `service.ts`, `service.test.ts` -- add update and remove as above, and keep the fake repository in `service.test.ts` type-complete -- AD-10, AD-15.
- [x] `apps/api/src/routes/problem-responses.ts`, `routes/todos.ts` -- add the 404 response and both routes, with documented responses PATCH 200, 400, 404, 500, 503 and DELETE 204, 404, 500, 503 -- AD-6, AD-9.
- [x] `packages/contract/openapi.json` -- run `pnpm gen:openapi` and commit the result -- AD-5.
- [x] `apps/api/test/openapi-schema.ts`, `test/integration/openapi.test.ts` -- support the new methods and 204. Assert the paths now include `/api/todos/{id}` with `delete` and `patch`, the exact response sets above, problem media type on errors, `Todo` on 200 and no content on 204 -- I9.
- [x] `apps/api/test/integration/todos.test.ts`, or a new `update-delete.test.ts` beside it -- every matrix row as I4, I5, I11 tests, checking stored rows and that every response is documented (I9), plus I8 injection payloads stored and returned inert through PATCH, and I4 that a PATCH of one field leaves the other and `createdAt` unchanged.
- [x] `apps/api/test/integration/storage.test.ts` -- I9: PATCH and DELETE with writes refused answer 503 with the row unchanged. PATCH on an unmappable row answers 500. Both are documented.
- [x] `apps/api/test/integration/logs.test.ts` -- re-tag the three tests to I13, and add I13 cases where a marker held in a description never appears in any log line: a successful PATCH, a PATCH refused for validation, a PATCH to an unknown id, a PATCH failing on storage (lock), and a successful and a storage-failed DELETE of a todo whose description holds the marker.
- [x] `apps/api/test/profile/logs.profile.test.ts` -- title leads with I13. A PATCH and a DELETE join the marker flow.
- [x] `apps/api/test/profile/headers.profile.test.ts` -- re-tag the I8 tests, and the untagged one, to I12. Add I12: PATCH 200, DELETE 204 and DELETE 404 answers through web-test carry the AD-19 headers.
- [x] `apps/api/test/contract/todos.contract.test.ts` -- I9 tests: PATCH `{completed:true}` 200 (body validated, `completed` true), PATCH `{}` 400 validation, PATCH unknown id 404, DELETE 204 then 404.
- [x] `apps/api/test/unavailable/api-down.contract.test.ts` -- add PATCH and DELETE routes to the I9 list, and make the header test I12 for every route.
- [x] `README.md` -- the logs paragraph covers update and delete.

**Acceptance Criteria:**
- Given the test profile is up, when `PATCH http://127.0.0.1:8081/api/todos/<id>` sends `{"completed":true}`, then it answers 200 with the todo completed. `DELETE` on that id answers 204, and a repeat answers 404. A `PATCH` with `{}` answers a `/problems/validation` problem.
- Given `pnpm test:all`, when it finishes, then it exits 0, and `coverage/scenarios.md` lists passing tests for I4, I5, I12 and I13 and for PATCH and DELETE under I8, I9 and I11. No header or log test is titled I8, I2, I10 or I7 any more.
- Given the regenerated contract, when `pnpm test` runs, then the committed `openapi.json` equals the generated one.

## Implementation Notes

- The PATCH/DELETE integration cases live in a new `apps/api/test/integration/update-delete.test.ts` beside `todos.test.ts` (47 tests). Unknown ids cover an unknown UUID, `not-a-uuid` and `' OR 1=1 --` (URL-encoded) for both methods. Bad descriptions (empty, whitespace-only, 201 code points) are tagged I4, alone and beside `completed: true`. Empty, missing, `null`, array, malformed and non-JSON bodies, the strict-type cases and the control characters are I11.
- The 204 is documented with `Type.Null({ description })`, which @fastify/swagger renders as a response with no `content`. The handler sends `reply.code(204).send(null)` (the type provider rejects a bare `send()` against a `null` schema). Fastify drops the body, `content-type` and `content-length` on 204.
- `openapi-schema.ts` gained `expectDocumentedNoContent(path, method, status, contentType, body)`: the status is documented with no `content`, and the response has no media type and an empty body. The contract suite uses it on a raw `fetch` for DELETE, since its `call` helper requires JSON.
- `storage.test.ts`'s `expectProblem` takes an optional documented path. PATCH on an unmappable row answers 500: the UPDATE itself succeeds, then `toTodo` throws, so the row's `completed` does change in that case (the plan asks only for the 500).
- `logs.test.ts`'s `create` helper became a general `send(method, path, body?)`, and the `BEGIN EXCLUSIVE` lock moved into `withWriteLock`. The three storage-lock tests (create, PATCH, DELETE) each wait out the 5 s busy timeout, so the file now takes about 17 s.
- `api-down.contract.test.ts` routes now carry both the called `url` and the documented `path`, and the header test runs per route as I12.
- Not run here (caller-owned): `pnpm test:all`, so the contract, profile and contract-unavailable changes are only typechecked.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 7 findings — high 0, medium 0, low 7, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` A DELETE (or PATCH) whose `:id` has malformed percent-encoding (e.g. `%E0%A4%A`) answers a 400 validation problem through `frameworkErrors`, which the DELETE operation does not document. — Real: find-my-way fails to decode it before routing, and the one error handler answers 400. GET `/api/todos` already answers the same undocumented 400 (pre-existing, `todos.test.ts:226`). No client sends a malformed escape, since the web client sends minted UUIDs. The fix means documenting 400 on DELETE (and GET) against AD-6's table, a contract change that is more than a direct correction. Left for the closing security review.
  - `[low]` `[reject]` A PATCH to a stored row that cannot be mapped to a todo (createdAt beyond the Date range) commits the UPDATE and then answers 500. — Real but unreachable in normal use: only a corrupted row reaches it, because the API alone sets `createdAt` (AD-7). The write is still one statement (AD-15). Making the mapping part of the write would need a transaction or a pre-check, which adds complexity for a case no user meets. Recorded in Implementation Notes.
  - `[low]` `[patch]` In `api-down.contract.test.ts`, the it.each titles interpolate `$url`, which holds a random UUID, so the PATCH and DELETE titles change every run. — Fixed: both titles use `$path` (`/api/todos/{id}`). The stable titles were confirmed in `coverage/scenarios.md` on the second `pnpm test:all`.
  - `[low]` `[patch]` No DELETE test reports under I8. The injection-string id case is tagged only I5. — Fixed: the unknown-id table rows carry an `also` tag, so the injection-string row reads "I4 I8 …" for PATCH and "I5 I8 …" for DELETE.
  - `[low]` `[patch]` The update refusal titles in `update-delete.test.ts` read like the create tests in `coverage/scenarios.md`, which shows only the `it` title. — Fixed: every I4 and I11 refusal title now says it is a PATCH.
  - `[low]` `[patch]` In `storage.test.ts`, the `expectProblem` leak regex misses UPDATE and DELETE SQL, though it now checks PATCH and DELETE answers. — Fixed: the regex adds `update |delete `.
  - `[low]` `[patch]` In `logs.test.ts`, the `STORAGE_FAILURE_TEST_MS` comment names only the insert, and the create storage test keeps a stale #32 comment and a loose `>= 400` assertion. — Fixed: the comment covers any write, the stale comment is gone, and the create storage test asserts `toBe(503)`.

### 2026-11-25 — Review pass (follow-up, thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- verdicts: 27 findings — high 0, medium 1, low 18, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind-hunter) The service's new `update`/`remove` existence rule has no unit test; the fake repository's methods only throw. — Added four unit tests in `service.test.ts` (I4 update pass-through, I4 update NotFoundError, I5 remove NotFoundError, I5 remove ok), with a `fakeRepository` helper.
  - `[low]` `[patch]` (blind-hunter) The `TodoParams` comment says any string reaches the route, but an `:id` longer than Fastify's `maxParamLength` (100) goes to the not-found handler instead. — Real, though the outcome is the same 404 with the same detail, because the not-found handler throws `NotFoundError`. Fixed the comment.
  - `[low]` `[reject]` (blind-hunter) The 500 storage test does not assert that the PATCH on an unmappable row was committed. — Real but rejected: asserting it would lock in the outcome that the first pass rejected as unreachable in normal use, and Implementation Notes already record it.
  - `[low]` `[reject]` (blind-hunter) Nothing covers a DELETE of an unmappable, corrupted row. — Real gap, but only a corrupted row reaches it (the API alone sets `createdAt`), so nobody meets it in everyday use, and it adds a test for a state that does not arise.
  - `[false]` `[reject]` (blind-hunter) `repository.update` with no changes yields "No values to set", answered 500. — No caller can reach it: the only caller is the PATCH route, whose schema requires `minProperties: 1`, so an empty change set never gets past validation.
  - `[low]` `[reject]` (blind-hunter) The first pass says the malformed-encoding 400 is "Left for the closing security review", yet `deferred: []`. — The fix edits this build's plan. That finding is a carried reject that cannot be deferred again. It is noted in the run report for the caller.
  - `[false]` `[reject]` (blind-hunter) The Plan Change Log is empty although the build departed from the plan (`send(null)`, helper changes). — By design, the Plan Change Log records only bad_plan loopbacks, and there were none. Implementation Notes records the deviations.
  - `[false]` `[reject]` (blind-hunter) The frontmatter (`review: thorough`, four lenses, `status: in-review`) disagrees with the Auto Run Result. — That was the mid-pass state this follow-up pass writes on purpose. Finalize sets `status` and appends this pass's result.
  - `[low]` `[reject]` (blind-hunter) The I/O matrix's Bad description row holds literal U+2028 and U+2029, which read as blanks. — Real, but the matrix is inside the read-only `<intent-contract>`, and the fix edits this build's plan.
  - `[low]` `[patch]` (blind-hunter) The successful-update log test puts the marker only in the new description, so a log line echoing the old one would pass. — The todo is now created with a marker of its own, and neither marker may appear ("I13 a successful update leaves its old and new descriptions out of every log line").
  - `[low]` `[patch]` (blind-hunter) The I12 header checks skip PATCH error answers through nginx. — The PATCH header test now covers 200, 400 (`{}`) and 404 (an unknown UUID) through web-test. It passed in `pnpm test:all`.
  - `[low]` `[patch]` (blind-hunter) The documented `id` path parameter has no description. — Added a description to `TodoParams.id` and regenerated `openapi.json`. Only the two parameter descriptions changed.
  - `[low]` `[patch]` (blind-hunter) "I4 changes only the todo it names" and "I4 lists an updated todo as stored" ignore the PATCH response. — Both now pass it through `expectUpdated` (status 200 plus the I9 documentation check).
  - `[low]` `[reject]` (edge-case-hunter) A DELETE sent with `Content-Type: application/json` and an empty or malformed body gets Fastify's 400, which the DELETE contract does not document. — Real: Fastify parses DELETE bodies, and `FST_ERR_CTP_EMPTY_JSON_BODY` becomes a validation 400. But today's web client sets Content-Type only on calls with a body, and no client sends one. The fix is either to document a 400 against AD-6's DELETE row or to override body parsing, which is more than a direct correction. Noted for story 5's client.
  - `[false]` `[reject]` (edge-case-hunter) `update` with changes `{}` emits an empty SET, mapped to 503. — Unreachable, as above: `minProperties: 1` stops it at validation, and the route is the only caller.
  - `[low]` `[reject]` (edge-case-hunter) A PATCH on an unmappable row commits the UPDATE, then answers 500. — carried: same location and claim as the first pass's rejected row, and the code is unchanged.
  - `[medium]` `[patch]` (verification-gap) The whitespace-only fixture `' \t\n '` fails the control-character pattern whether or not trimming runs first, so nothing proves the trim-before-schema order for PATCH or for POST's now-shared hook. — Added a spaces-only description (`'   '`) to the PATCH refusal tables (alone and beside `completed`) and to POST's I2 table. Added padded-200 success cases for PATCH (I4) and POST (I2) that store `'x'.repeat(200)`.
  - `[low]` `[reject]` (intent-alignment) Most matrix rows are proven in-process, and only a subset through web-test. — This follows AD-20's layering: matrix behaviour in-process through `buildApp`, while the contract suite validates representative answers of each operation against openapi.json. Adding every row at the stack would be more than a direct correction for no user-visible gap.
  - `[low]` `[reject]` (intent-alignment) "Row unchanged and still listed" on a storage refusal is proven only under `query_only`, not under the logs test's write lock. — `query_only` is the in-process failure injection AD-20 prescribes. The logs test exists to prove I13, not row state.
  - `[low]` `[reject]` (intent-alignment) A PATCH on an unmappable row answers 500 after committing, which diverges from the outcome-level reading of "atomic". — carried: the first pass's rejected row, and the code is unchanged.
  - `[low]` `[patch]` (intent-alignment) "One statement" and "existence from the write's result" are enforced by the code's shape, not by tests; the service rule has no unit test. — Grouped with the first blind-hunter row: the new service unit tests pin the existence rule against the repository's write result.
  - `[false]` `[reject]` (intent-alignment) That every non-2xx answer goes through the one error handler is only inferred from the body shape. — No bad outcome: every problem answer in the new tests is validated against the closed `Problem` schema and media type, and the handler is the only producer of that shape (AD-9).
  - `[false]` `[reject]` (intent-alignment) I13 does not cover a DELETE to an unknown id. — It cannot leak todo text: the request carries no body, and an unknown id has no stored description.
  - `[low]` `[patch]` (intent-alignment) I12 does not cover the API's own PATCH 400 and 404 through nginx. — Grouped with the blind-hunter header row: the PATCH header test now covers 400 and 404.
  - `[false]` `[reject]` (intent-alignment) The consumer surface (the web stories) is exercised only through the contract and HTTP. — Descriptive, with no defect: the intent's Never list excludes web changes.
  - `[low]` `[reject]` (intent-alignment) PATCH unknown-id tests are tagged I4, whose text does not name not-found. — test-strategy has no update-not-found id, and I4 is the update scenario. Re-tagging would invent an id.
  - `[false]` `[reject]` (intent-alignment) The precedence between errors (400 or 404, 404 or 503) is not pinned. — Descriptive. The matrix sets no order, and Fastify's fixed lifecycle (validation before the handler) decides it deterministically, so no outcome is wrong.

## Design Notes

A non-UUID path id answers 404, not 400. AD-6 gives `DELETE` only `404`, and a string that is not stored is simply not found. The parameterised query makes any string safe. Ajv already validates `id` as a UUID on create, where the client mints it.

Existence comes from the one write's result: `returning().get()` gives `undefined`, or `run().changes` is 0. A find before the write would add a statement for no gain.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0
- `pnpm test` -- expected: all unit, component and integration tests pass, the openapi equality test included
- `pnpm test:all` (holding the todo-test stack lock) -- expected: exit 0. `coverage/scenarios.md` shows I4, I5, I12, I13 passing, and PATCH or DELETE titles under I8, I9 and I11.

**Manual checks (if no CLI):**
- With todo-test up, use curl for the ticket's checks: PATCH `{"completed":true}` gives 200 with completed true, DELETE gives 204 then 404, PATCH `{}` gives 400 validation. Then take the stack down.

## Auto Run Result

**Status:** built

**Summary:** The API now updates and deletes a todo. `PATCH /api/todos/{id}` accepts `{ description?, completed? }` with at least one field. It applies AD-8's strict validation and trimming, and answers 200 with the full todo. `DELETE /api/todos/{id}` answers 204. An unknown id, a non-UUID one included, answers 404 not-found on both routes. A storage failure answers 503 unavailable. Each write is one SQL statement, and the service decides existence from that statement's result. `openapi.json` is regenerated and documents both operations with 503. Integration, storage, log, contract, contract-unavailable and profile tests cover them. The header and log tests that borrowed I8, I2, I10 and I7 are re-tagged I12 and I13.

**Files changed:**
- `packages/contract/src/todo.ts`, `index.ts`: the new `UpdateTodoBody` schema.
- `packages/contract/openapi.json`: regenerated with `/api/todos/{id}` (patch, delete).
- `apps/api/src/todos/repository.ts`: one-statement `update` and `remove`.
- `apps/api/src/todos/service.ts`: `update` and `remove`, with `NotFoundError` when no row is found.
- `apps/api/src/todos/service.test.ts`: the fake repository gets the new methods.
- `apps/api/src/routes/todos.ts`: the PATCH and DELETE routes, and one shared `trimDescription` for POST and PATCH.
- `apps/api/src/routes/problem-responses.ts`: a 404 problem response.
- `apps/api/test/openapi-schema.ts`: the patch and delete methods, and `expectDocumentedNoContent` for 204.
- `apps/api/test/integration/update-delete.test.ts` (new): I4, I5, I8 and I11 for update and delete, with I9 documentation checks.
- `apps/api/test/integration/openapi.test.ts`: I9 checks of the new path and its response sets.
- `apps/api/test/integration/storage.test.ts`: I9 for 503 on PATCH and DELETE and 500 on PATCH, with the stored row unchanged.
- `apps/api/test/integration/logs.test.ts`: the old tests re-tagged I13, and six I13 update and delete cases.
- `apps/api/test/contract/todos.contract.test.ts`: I9 for PATCH 200, 400 and 404, and DELETE 204 then 404.
- `apps/api/test/unavailable/api-down.contract.test.ts`: I9 and I12 for nginx's 503 on PATCH and DELETE.
- `apps/api/test/profile/headers.profile.test.ts`: re-tagged I12, plus PATCH and DELETE header checks.
- `apps/api/test/profile/logs.profile.test.ts`: tagged I13, and the flow now covers PATCH and DELETE.
- `README.md`: the logs paragraph covers update and delete.

**Review:** a quick lens with 7 findings, all low. 5 were patched: stable contract-unavailable titles, I8 on the injection-id DELETE, PATCH named in the refusal titles, the SQL leak regex, and the logs comments with the 503 assertion. 2 were rejected:
- An undocumented 400 for a malformed percent-encoded id. It is pre-existing on GET and unreachable from the client, and fixing it would mean departing from AD-6's table.
- A PATCH to an unmappable, corrupted row commits before answering 500. Only a corrupted row reaches it, and fixing it would add a transaction for no user case.

Nothing was deferred.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 5.

**Verification:**
- `pnpm typecheck`: exit 0.
- `pnpm test`: 19 files and 335 tests passed, both before and after the review patches.
- `pnpm test:all` ran twice under the todo-test stack lock, after implementation and after the patches. Both runs exited 0 with every step passed, the todo-test teardown included. `coverage/scenarios.md` shows I4 (15), I5 (5), I8 (10), I9 (30), I11 (36), I12 (12) and I13 (10) all passing.
- Manual curl through 127.0.0.1:8081 on a fresh todo-test stack:
  - POST answered 201.
  - PATCH `{"completed":true}` answered 200 with `completed: true`.
  - PATCH `{}` answered 400 `/problems/validation`.
  - DELETE answered 204, and a repeat answered 404 `/problems/not-found`.
  - The stack was then taken down.
- Matrix audit: every I/O row has a passing covering test, in `update-delete.test.ts` or, for the storage rows, `storage.test.ts`.

**Residual risks:** The two rejected low findings above. `logs.test.ts` now takes about 17 s, because three tests wait out SQLite's 5 s busy timeout.

### Follow-up review pass (thorough), 2026-11-25

**Status:** built

**Summary:** A follow-up pass with the thorough lens set: blind-hunter, edge-case-hunter, verification-gap and intent-alignment. It found nothing that changes the routes' behaviour. The patches tighten the tests and the contract's docs. App code changes only in the `TodoParams` comment and the `id` description.

**Files changed this pass:**
- `apps/api/src/todos/service.test.ts`: unit tests for the update and remove existence rule (I4, I5).
- `apps/api/src/routes/todos.ts`: the `TodoParams` comment (`maxParamLength`), and a description on `id`.
- `packages/contract/openapi.json`: regenerated with the `id` parameter descriptions.
- `apps/api/test/integration/update-delete.test.ts`: a spaces-only refusal case, a padded-200 success case, and the two PATCH responses now checked.
- `apps/api/test/integration/todos.test.ts`: a spaces-only refusal case and a padded-200 success case for POST.
- `apps/api/test/integration/logs.test.ts`: the successful-update test also marks the old description.
- `apps/api/test/profile/headers.profile.test.ts`: I12 also covers PATCH 400 and 404 through web-test.

**Review findings:** 27 findings.
- 8 entries patched: 1 medium (the trim-order verification gap) and 7 low, two of them grouped with intent-alignment rows.
- 0 deferred.
- 3 rows carried from the first pass as rejects, the unmappable-row 500 among them.
- 18 rejected, each with its recorded reason in the triage log above. One worth flagging: a DELETE sent with a JSON Content-Type and an empty body gets an undocumented 400 from Fastify, so story 5's client must not set Content-Type on DELETE.

**Follow-up review recommended:** false. This is a follow-up pass, and no high finding was patched. Patched this pass: high 0, medium 1, low 7.

**Verification:**
- `pnpm typecheck`: exit 0.
- `pnpm test`: 344 tests passed.
- `pnpm test:all`, under the todo-test stack lock: exit 0, with every step passed, teardown included. `coverage/scenarios.md` shows I2, I4, I5, I8, I9, I11, I12 and I13 all passing.
