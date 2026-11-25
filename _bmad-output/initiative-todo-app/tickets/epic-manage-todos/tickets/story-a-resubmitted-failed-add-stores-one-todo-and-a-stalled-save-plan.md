---
title: 'A resubmitted failed add stores one todo, and a stalled save gives up in time'
type: feature
ticket: '1'
created: '2026-11-25'
status: built
baseline_revision: 'e8b4cade8b38c6ae28d4f35302da7875af417d3d'
route: full
route_source: auto
risk: high
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

**Problem:** `addTodo` mints a new id on every call, so a failed add whose response was lost after the API stored it is stored twice when the user presses Add again; `createTodo` has no timeout and nginx bounds only the connect, so a stalled API holds the optimistic card for nginx's default 60 s. `MutationSpec.position` is declared but ignored, and every e2e spec copies its own helpers.

**Approach:** The add form passes the failed add's id back to the helper when its restored text is submitted unchanged, so AD-6's `200` replay dedupes; a create resets its chain's failed flag so a resubmitted create's follow-ups are sent. nginx gets `proxy_read_timeout 10s` on `/api/`, and the client aborts a write after 15 s with no response, classified `network`. `position` goes. One `e2e/helpers.ts` replaces the copied e2e helpers.

## Boundaries & Constraints

**Always:** reuse the id only when the submitted (prepared) text equals the restored text exactly and that restore is still current; keep the add form's restore rule (only into an empty field), "Add landed after all", the optimistic add on top, the Announcer wording, AD-6's contract and status codes, `proxy_connect_timeout 1s`; a fetch aborted by the caller's own signal stays a cancellation; the list `GET` gets no client timeout; every e2e test keeps its axe scan in all three Playwright projects.

**Never:** a new problem type, toast, message string or test-only switch in app code (AD-9, AD-14, AD-20); e2e failure injection other than `page.route` (`page.clock` only moves browser time); changes to the API, `openapi.json`, compose, CI deploy steps, or the architecture spine; making `position` work.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Resubmit, first one stored | add A (id1) failed with any kind, text restored; user submits A unchanged | POST carries id1; API answers 200 replay; one card; "Added “A”." | none |
| Resubmit, first one not stored | same, API never stored id1 | POST id1 answers 201; created as usual | none |
| Changed text | restored A edited to B (any edits) and submitted | new id; never 409 from reuse | none |
| Edited back to identical text | restored A, typed and deleted back to exactly A | treated as unchanged: id1 reused (safe, same description) | none |
| Not restored | add A failed while field held other text | A's id is never reused; a later A is a new id | none |
| Resubmitted create with follow-up | create(id1) pending again, follow-up queued on id1, old failed chain still alive | follow-up sent after the create succeeds; dropped if it fails | failed create drops its own follow-ups only |
| nginx stall | API accepts TCP but never answers | nginx answers AD-4's literal 503 after ~10 s on every `/api` route | add reverts, unavailable reason |
| Client stall | no response to a write for 15 s | client aborts; `RequestFailure('network')`; add reverts with the network reason | timer cleared once settled |
| Caller abort | list GET's signal aborted | rethrown as cancellation, never `network`; no timer on GET | unchanged |

</intent-contract>

## Code Map

- `apps/web/src/todos/mutations.ts` -- `MutationSpec.position` (remove, and from `addTodo`); `addTodo(description)` mints `crypto.randomUUID()` (add optional reused id); `execute()` sets `chain.createFailed = true` on a failed create and never resets it (reset to false when a `create` starts executing); chains are deleted when `pending` empties, so the reset matters only when an old failed chain is still alive.
- `apps/web/src/todos/hooks.ts` -- `useAddTodo()` return type follows the new `addTodo` signature.
- `apps/web/src/components/AddForm.tsx` -- `restored` ref `{id, text}` set after a failed add restores into an empty field; `submit()` clears it and calls `addTodo(description)`. Decide reuse in `submit()` before clearing. Do not touch the restore rule, landed-after-all, caret or validation code.
- `apps/web/src/api/client.ts` -- `request()` classifies a fetch rejection as `network` unless `isCancellation(error, signal)`; `createTodo` sends no signal; `listTodos(signal)` must stay timer-free.
- `apps/web/nginx.conf` -- `/api/` location: has `proxy_connect_timeout 1s` and `error_page 502 503 504 = @api_unavailable`; add `proxy_read_timeout 10s` with a comment (a 504 from it becomes AD-4's 503).
- `apps/web/src/api/client.test.ts`, `apps/web/src/todos/mutations.test.ts` (its `createSpec` uses `position`), `apps/web/src/components/AddForm.component.test.tsx` (MSW `serve`/`gate` helpers around line 335+, `NOT_STATUS`) -- extend; reuse their helpers.
- `apps/api/test/profile/stack.ts` (`compose`, `call`, `listTodos`), `restart.profile.test.ts` (`waitForHealth` pattern), `apps/api/test/openapi-schema.ts` (`UNAVAILABLE_BODY`, `PROBLEM_MEDIA_TYPE`), `apps/api/test/security-headers.ts` -- reuse in a new profile test.
- `e2e/*.spec.ts` -- copies of `uniqueDescription` (todos, refresh, add-failure, validation), `todoItem` (four specs), `todoList`, `quoteText` (todos), `announcement` (add-failure, refresh), message strings `UNAVAILABLE`/`NETWORK`/`REFRESH` (add-failure, refresh, offline), `UNAVAILABLE_BODY` (add-failure, refresh), `inlineError` (validation). `e2e/axe.ts` is the only shared module; `testMatch: '*.spec.ts'` so `e2e/helpers.ts` is not run as a spec.
- `README.md` line ~70 -- the `pnpm test:all` row lists the profile checks.

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/src/api/client.ts` -- export `WRITE_TIMEOUT_MS = 15_000`; give `request()` an optional timeout: an own `AbortController` + `setTimeout`, combined with a caller signal via `AbortSignal.any` only when both exist, cleared in `finally` after the body is read; when the timer fired and the caller's signal did not abort, throw `RequestFailure('network', …)` from any stage; `createTodo` uses it, `listTodos` does not -- AC5.
- [ ] `apps/web/nginx.conf` -- `proxy_read_timeout 10s;` in `location /api/`, comment why -- AC4.
- [ ] `apps/web/src/todos/mutations.ts` -- remove `position`; `addTodo(description, id?)` reuses `id` when given; in `execute()` a `create` sets `chain.createFailed = false` before sending -- AC1, AC3, R9.
- [ ] `apps/web/src/todos/hooks.ts` -- `useAddTodo` signature -- AC1.
- [ ] `apps/web/src/components/AddForm.tsx` -- in `submit()`, `const reuse = restored.current?.text === description ? restored.current.id : undefined` before clearing it; pass to `addTodo` -- AC1, AC2.
- [ ] `apps/web/src/api/client.test.ts` -- `U4`-titled tests with fake timers: a create with no response for 15 s rejects `network` (fetch mock rejects on its signal's abort) and not before; a create answered in time leaves no timer; `listTodos` passes the caller's signal through untouched and arms no timer; a caller abort still rethrows -- AC5.
- [ ] `apps/web/src/todos/mutations.test.ts` -- drop `position`; U4: `addTodo` with an id sends it and announces Added on a 200 replay body; without one mints a fresh UUID; U5: create(id1) fails with follow-up f1 queued and create(id1) again with f2 behind it: f1 dropped, f2 sent after the second create succeeds; a second variant where the second create fails drops f2; and the plain case (old chain gone) -- AC1, AC3.
- [ ] `apps/web/src/components/AddForm.component.test.tsx` -- K1: restored text resubmitted unchanged sends the first id (MSW answers 200 replay; one card, "Added"); edited to different text sends a new id; edited and returned to identical text reuses; text not restored (field was non-empty) then submitted later uses a new id -- AC1, AC2.
- [ ] `apps/api/test/profile/stalled-api.profile.test.ts` -- pause `api` with `compose('pause','api')`, call GET `/api/todos`, POST `/api/todos` (fresh id X), GET `/api/health` concurrently: each answers 503 with `PROBLEM_MEDIA_TYPE`, body `=== UNAVAILABLE_BODY`, security headers, elapsed between 9 s and 13 s; then unpause (in `finally`, plus an `afterAll` safety unpause), wait for health 200, POST X again with the same description: 200 or 201, and the list holds X exactly once. Titles start `I9` / `I10` -- AC4, the Verify's API half.
- [ ] `e2e/helpers.ts` -- `uniqueDescription(prefix, project)`, `todoList`, `todoItem`, `quoteText`, `announcement(page, text|RegExp)` (the Announcer's `role="status"` message filtered by text), `MESSAGES` (unavailable, network, refresh reasons), `UNAVAILABLE_BODY`, `visibleText(page, text)` (excludes `[role="status"]`) -- AC6.
- [ ] `e2e/todos.spec.ts`, `refresh.spec.ts`, `add-failure.spec.ts`, `offline.spec.ts`, `validation.spec.ts`, `motion.spec.ts` -- import the helpers, delete every local copy, keep behaviour and axe scans -- AC6.
- [ ] `e2e/add-failure.spec.ts` -- two new `E6 E8` tests, by keyboard, each with an axe scan: (a) lost response: POST route `route.fetch()` then `route.abort()`, the settle-time GET aborted once so the text stays; Enter resubmits; assert the second POST's body id equals the first's and it answered 200, "Added “t”." shows, one item; reload shows one item. (b) stalled: `page.clock.install()` before `goto`; POST route forwards with `route.fetch()` then holds; `page.clock.fastForward(15_000)`; card goes, network reason, text restored; GET aborted once; resubmit → one item, also after reload. If `page.clock` proves flaky, wait the real 15 s with `test.setTimeout` raised -- AC1, AC5, AC7.
- [ ] `README.md` -- add the stalled-API check to the profile list -- docs accuracy.

**Acceptance Criteria:**
- Given the ticket's Verify on the test profile (api paused 12 s while adding), when the add is made, then the card reverts within about 10 s with the unavailable reason, and after unpausing a resubmit of the unchanged text leaves exactly one todo after a refresh (proved by the profile test plus e2e (a)/(b); a by-hand run is optional).
- Given `pnpm test:all`, when it runs, then every step passes, including axe coverage and scenario coverage, in all Playwright projects.
- Given the e2e specs, when grepped, then no spec defines `uniqueDescription`, `todoItem`, `announcement`, a message string or a visible-only error locator of its own.
- Given `pnpm typecheck`, when it runs, then no reference to `MutationSpec.position` remains and it passes.

## Implementation Notes

- Files touched: `apps/web/src/api/client.ts` (+ test), `apps/web/nginx.conf`, `apps/web/src/todos/mutations.ts` (+ test), `apps/web/src/todos/hooks.ts`, `apps/web/src/components/AddForm.tsx` (+ component test), `apps/api/test/profile/stack.ts`, `restart.profile.test.ts`, new `stalled-api.profile.test.ts`, new `e2e/helpers.ts`, every `e2e/*.spec.ts`, `README.md`.
- `request()` split into `send()` (the old classification, unchanged) and a `request()` wrapper that arms the timer only when given `timeoutMs`; `listTodos` takes the untouched path (its signal is passed through as is, no timer). The wrapper turns any error into `network` once the timer has fired and the caller's own signal has not aborted.
- Decision beyond the plan's literal tasks: `revert()` of a failed create used to remove the todo outright. With a resubmitted create for the same id already queued behind it (the matrix's "old failed chain still alive" row), that removed the resubmitted create's optimistic card too. It now re-applies the pending calls from the next queued create on, so the resubmitted card (and its own follow-ups' changes) stays, while the follow-ups queued between the two creates are still dropped. Without a later create the behaviour is unchanged. Covered by the U5 tests' cache assertions.
- `waitForHealth` moved from `restart.profile.test.ts` into `stack.ts`, shared with the new profile test.
- e2e descriptions now come from `uniqueDescription(prefix, project)` everywhere (offline and motion had inline variants); announcement assertions in add-failure, offline and refresh go through `quoteText`, since the longer random suffix could push a description past 40 code points.
- In the component tests the server double hides the lost add from the list until a create is answered, standing in for the e2e's aborted settle-time GET.
- Review round 1: every Announcer and Inline-error string the specs assert on now lives in `MESSAGES` (`addOutcome`, `added(t)`, `addFailed(t, reason)`, `empty`, `overLimit`, `overLimitSuffix`), with a `containing(text)` literal pattern; `announcement()` excludes the add form's status and a new `fieldStatus()` locates it. The profile comments in `vitest.config.ts` and `scripts/test-all.mjs` mention the pause.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` Specs still held message strings of their own ('Enter a description.' five times in `validation.spec.ts`, 'over the character limit', the Added / Couldn't add leads and a local `ADD_OUTCOME` regex), so AC6 was met only to the letter of the grep — verified by grep; a copy change in `messages.ts` would need edits in several specs. Fixed: the strings moved into `MESSAGES` in `e2e/helpers.ts` (`addOutcome`, `added`, `addFailed`, `empty`, `overLimit`, `overLimitSuffix`, plus `containing()`), and every spec uses them; only a test title still quotes one.
  - `[low]` `[patch]` `announcement()` documented as the Announcer's message but matched any `role="status"`, including the add form's Field status that `validation.spec.ts` relied on; same text in both regions would break a strict assertion (the P2 pitfall) — verified at `AddForm.tsx` (form `role="status"`). Fixed: `announcement()` excludes `form [role="status"]`, new `fieldStatus()` helper used for the two Field-status assertions.
  - `[low]` `[patch]` `AddOutcome` doc in `mutations.ts` still said "the id the client minted" though the id can now be passed back — verified. Fixed: doc names both sources.
  - `[low]` `[patch]` `vitest.config.ts` and `scripts/test-all.mjs` comments described the profile step without the new api pause — verified. Fixed: both mention the pause (I9, I10).

## Design Notes

- Reuse rule: the observable rule is "the submitted text equals the restored text". AC2's "changed in any way (even back and forth to a different value)" ends at a different value, so it mints; text edited and returned to exactly the restored value is unchanged, and reusing is safe because AD-6 replays only on the same trimmed description. A `409` from reuse is impossible.
- A create resets `createFailed` when it executes, not when queued: follow-ups queued behind the old failed create still run first in chain order and are dropped; those behind the new create follow its outcome.
- Two timeouts: nginx's 10 s read timeout yields a 504 that the existing `error_page` turns into AD-4's literal 503 (unavailable); the client's 15 s is a backstop for when nginx itself does not answer (network). Paused container: the kernel still completes the TCP handshake, so the connect succeeds and the read times out.
- For the architect (spine Deferred line on a write that may have landed): as built, a failed add whose restored text is resubmitted unchanged reuses its id, so a lost or timed-out response that was stored replays as `200`; changed text, or text never restored, mints a new id. The spine is not edited here.

## Verification

**Commands:**
- `pnpm install --frozen-lockfile` -- expected: installs.
- `pnpm typecheck` -- expected: passes (root and every package, e2e included).
- `pnpm test` -- expected: unit, component, integration pass, including the new U4, U5 and K1 tests.
- `pnpm test:all` (with the `/tmp/todo-test-stack.lock` lock) -- expected: every step `passed`, including the new profile test, e2e (all three projects), axe coverage and scenario coverage.
- `grep -nE "function (uniqueDescription|todoItem|todoList|announcement|quoteText|inlineError)|const (UNAVAILABLE|NETWORK|REFRESH|UNAVAILABLE_BODY) =" e2e/*.spec.ts` -- expected: no output.
- `grep -rn "position" apps/web/src/todos` -- expected: no `MutationSpec.position` left.

## Auto Run Result

- **Summary:** A failed add whose restored text is submitted unchanged now reuses its id, so AD-6's `200` replay stores one todo when the first create landed; a create resets its chain's failed flag (and a failed create's revert keeps a resubmitted create queued behind it), so a resubmitted create's follow-ups are sent. nginx answers a stalled API with AD-4's 503 after 10 s (`proxy_read_timeout 10s`); the client aborts a write after 15 s with no response as `network`; the list `GET` has no timer. `MutationSpec.position` is removed. The e2e specs share `e2e/helpers.ts`.
- **Files changed:**
  - `apps/web/src/api/client.ts` -- `WRITE_TIMEOUT_MS`, optional request timeout classified `network`; `createTodo` uses it.
  - `apps/web/nginx.conf` -- `proxy_read_timeout 10s` on `/api/`.
  - `apps/web/src/todos/mutations.ts` -- `position` removed; `addTodo(description, id?)`; create resets `createFailed`; revert keeps a later resubmitted create.
  - `apps/web/src/todos/hooks.ts` -- `useAddTodo` signature.
  - `apps/web/src/components/AddForm.tsx` -- passes the restored add's id when the submitted text equals the restored text.
  - `apps/web/src/api/client.test.ts`, `apps/web/src/todos/mutations.test.ts`, `apps/web/src/components/AddForm.component.test.tsx` -- U4, U5 and K1 tests for the timeout, id reuse and resubmitted chains.
  - `apps/api/test/profile/stalled-api.profile.test.ts` (new), `stack.ts`, `restart.profile.test.ts` -- I9 paused-api 503 in 9-13 s on every `/api` route; I10 same-id resend stored once; shared `waitForHealth`.
  - `e2e/helpers.ts` (new) and every `e2e/*.spec.ts` -- shared helpers and copy; two new E6 E8 tests (lost response, stall via `page.clock`), each resubmitting to one todo.
  - `README.md`, `vitest.config.ts`, `scripts/test-all.mjs` -- profile step descriptions.
- **Review:** quick lens, 4 findings (medium 1, low 3); 4 patches applied (1 medium, 3 low), 0 deferred, 0 rejected.
- **Follow-up review recommended:** false (no high patched; one medium patched, and it was test-copy consolidation now verified by the full run).
- **Verification:** `pnpm typecheck` passes; `pnpm test` 291 passed; `pnpm test:all` exit 0 after the review patches (unit 188, component 48, integration 55, contract 6, e2e 45 across desktop/phone/desktop-dark, axe coverage 45 tests / 60 scans, profile 17 incl. the stalled-API I9 (503 after ~10.2 s in the first run) and I10, contract-unavailable 4, scenario coverage, teardown); the plan's two greps return nothing relevant.
- **Residual risks:** the stall e2e uses `page.clock` and has passed twice in all projects but is not soak-tested; a timer firing just after an error body is read could report `network` (negligible window); the by-hand Verify on the test profile was not run (its API half is automated by the profile test, its UI half by the e2e tests).
