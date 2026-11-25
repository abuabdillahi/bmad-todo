---
title: 'Refactor sweep'
type: refactor
ticket: '7'
created: '2026-11-25'
status: built
baseline_revision: '4c478eb339504e4e1d4c13b7b720790d500e5381'
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
deferred:
  - summary: >-
      More copied e2e blocks remain: the "hold the PATCH" route setup and the 503 / no-response failure matrix.
    evidence: |-
      The "hold the PATCH" setup (`let hold…; const held = new Promise<Route>…; page.route(TODO_PATH, (route) => (isPatch(route) ? hold(route) : route.continue()))`) appears in both e2e/complete.spec.ts:69-71 and e2e/edit.spec.ts:92-94. The failure matrix ('a 503 from the API' fulfilled with UNAVAILABLE_BODY, and 'no response' aborted) is copied in add-failure, complete, edit, delete and list-states. This is pre-existing duplication outside the sweep's named scope. Sharing it needs new parameterised helpers in e2e/helpers.ts.
    location: >-
      e2e/complete.spec.ts:69, e2e/edit.spec.ts:92
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 2 left cleanup behind (ticket Notes, Decision 2026-11-25 on scope): the rule that moves focus off a removed row exists twice (`TodoCard.tsx`, `TodoList.tsx`), the "deleted elsewhere" announcement dedupe compares a todo's text instead of its id, and the epic's code carries copied helpers (five component-test files, three e2e specs, two API integration files, two keyboard and tap checks in components).

**Approach:** Fold the row-focus rule into one function the list area owns and hands to each card. Key the dedupe on the todo's id through a record the mutation helper keeps of its last not-found announcement. Move each copied helper into one shared place. Behaviour is unchanged, apart from the dedupe fix the Decision allows, and every existing test keeps its assertions and passes.

## Boundaries & Constraints

**Always:**
- Cleanup only: what a user sees and hears, focus targets, announcements, requests and timings stay as they are. The one intended change: a todo whose text matches a different todo's showing "deleted elsewhere" message is still announced.
- Existing test assertions stay as written. Only helper definitions move, and each moved helper keeps its body.
- Scenario tags stay on test names (K3, K6, U5…), so `coverage/scenarios.md` keeps listing them.
- Anything that would change behaviour beyond the dedupe fix is not built. It is recorded in Implementation Notes as a named new bug.

**Never:**
- Change `run`, `execute`'s order of revert, `recordRevert` and announce, `revert` or `settle` in `mutations.ts`, or the `announce(kind, text)` call signature. The mutation tests assert those calls exactly.
- Touch the out-of-scope items: 2.1's AC2 reading, 2.3's Empty-panel focus, the architecture spine, 2.12's Firefox undo question, 2.2's undocumented 400s.
- Touch `.github/workflows`, compose, nginx or the API's runtime code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Same todo | A toggle on X answered 404 while X is in edit mode, then the refetch removes X | One "deleted elsewhere" message (the helper's). The list announces nothing. | Unchanged (existing EditForm K3 test) |
| Same text, other todo | A and B both read "Buy milk". A's toggle 404s while B is in edit mode, and the refetch removes both | The list announces B's loss once, after the helper's message for A | New: before this change it was skipped |
| No helper message | A refetch removes the row in edit mode | Announced once, and not again on the next refetch | Unchanged |
| 404 on a check or a save | Focus is in the row | Focus moves at once to the next operable row's check, else the previous one's, else the Todo list | Unchanged (TodoCard K6, EditForm K3, ListStates K5) |
| Confirm delete | Rows around it, some of them Leaving | Focus goes to the next operable check, else the previous one's, else the add field, or the heading after a tap | Unchanged (DeleteConfirm K6) |
| Refetch removal | A tracked row is gone and focus is on `<body>` | Focus goes to the check at its place, else the one before, else the Empty panel, the list or the heading | Unchanged (EditForm, ListStates) |

</intent-contract>

## Code Map

- `apps/web/src/components/TodoCard.tsx` -- `checkOf`, `operableSibling` (l.41-51) and `addField()` (l.53) are the card's copy of the row rule and its DOM lookups. `moveFocusOffRow` (l.152) runs after a 404 on a toggle or a save. `confirmDelete` (l.205) holds the after-delete rule, `main h1` and the tap check. `handleConfirmKeyDown` (l.191) checks composing (IME) input. `lastPointerType` (l.129, l.250).
- `apps/web/src/components/TodoList.tsx` -- the refetch focus move (l.232-265) is the list's copy of the rule (`previousIds`, `at`, `targetId`, the row lookup that skips `data-leaving`, `fallbackTarget`). `editingFor`/`confirmFor` build the card props. The vanish effect (l.273-290) calls `announceDeletedElsewhere(last.description)`. The tap check in `handleTryAgain` (l.317-329). `focusTargets: AnnouncerFocusTargets` comes from App: `addField` is the "New todo" textarea and `heading` is `main h1`, the same elements the card finds by DOM query.
- `apps/web/src/components/EditForm.tsx` (l.39-45), `TextField.tsx` (l.316-323) -- the same `isComposing || keyCode === 229` check as the card.
- `apps/web/src/todos/hooks.ts` l.89-105 `useAnnounceDeletedElsewhere` -- the dedupe compares text.
- `apps/web/src/todos/mutations.ts` -- `MutationHelper`, and `execute`'s failure `settle` (l.192-197). A follow-up's `not-found` is announced as `deletedElsewhere` (`setCompleted`, `editDescription`); delete swallows `not-found`.
- Component tests with copied helpers: `TodoCard`, `EditForm`, `DeleteConfirm`, `ListStates`, `Announcer` `.component.test.tsx`. Their copies: `gate`, `problem` (ListStates' returns an answer function), `serve` (DeleteConfirm's is the superset: GET, PATCH, DELETE, POST; EditForm adds `fail` on PATCH), `liveElement`, `check`, `row`, `card`, `renderLoaded(names)` (EditForm and DeleteConfirm: with `context`, `listAnnounce`, `refetch`), `holdLeaveTimers`, `serveLists`/`Answer`, `settled`, `regainFocus`, and the `UNAVAILABLE`/`NETWORK`/`GENERIC` strings. The fixtures differ: ListStates' `rent` is active and the others' is done, and Announcer uses `todo`. Existing shared modules: `apps/web/test/render.tsx` (`renderApp`, whose `list` is a getter), `test/msw.ts`, `test/drop.ts`.
- `e2e/helpers.ts` -- the shared e2e module. Copies to move into it: `TODO_PATH` (complete, edit, delete), `isPatch` (complete, edit), `patchAndRefetch` (complete, edit), `regainFocus` (edit, refresh).
- `apps/api/test/integration/update-delete.test.ts` copies `storedRows`, `expectValidationProblem` and `expectNothingLeaked` from `todos.test.ts`. They differ only in the documented path and method, and in the SQL words in the leak regex.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/TodoList.tsx` -- extract the refetch move's target computation into one function: the check of the operable row now at `id`'s place among `ids`, else the one before it, else null. `before` is the order `id` held its place in. Use it in the layout effect (`?? fallbackTarget()`), and give each live card a `focus` prop: `nextCheck()` = that function with `previousIds.current`, and the same list without the card's id, plus `targets: focusTargets`. -- Item 1: one rule.
- [x] `apps/web/src/components/TodoCard.tsx` -- add a `CardFocus` prop (`nextCheck`, `targets`), with an inert default for Leaving copies. `moveFocusOffRow` = `nextCheck() ?? item.closest('ul')`, still only when the row holds focus. `confirmDelete` = `nextCheck()`, else `targets.heading` (`preventScroll`) after a tap, else `targets.addField`, then `flushSync(confirm.remove)` as now. Remove `checkOf`, `operableSibling` and `addField()`. -- Item 1.
- [x] `apps/web/src/todos/mutations.ts` -- on a follow-up whose failure is `not-found`, record `{ id, text }` of the failure text it announced, in the same settle step. Expose it read-only on `MutationHelper` (for example `lastNotFound(): { id; text } | null`). -- Item 2.
- [x] `apps/web/src/todos/hooks.ts`, `TodoList.tsx` -- `useAnnounceDeletedElsewhere()` takes `{ id, description }`. It skips only when the helper's record has this id and the showing message is a `failure` with the record's text. Otherwise it announces `deletedElsewhere(description)` as now. Update its doc comment, and the list passes `{ id, description }` from `watched`. -- Item 2.
- [x] `apps/web/src/components/EditForm.component.test.tsx` -- add a `K3` test for the same-text row of the matrix: `listAnnounce` is called once, with B's message. `apps/web/src/todos/mutations.test.ts` -- add a `U5` test that a follow-up's 404 records its id and text, and that other failures and successes don't. -- Item 2 coverage.
- [x] A new `apps/web/src/components/` hook (for example `useTapOrigin`: `onPointerDown`, and a `tapped(event)` that reads and clears it, true for touch or pen with `detail !== 0`), used by `TodoCard` and `TodoList`. Export a composing-key check from `TextField.tsx` (`isComposing || keyCode === 229`), used by `TextField`, `EditForm` and `TodoCard`. -- Item 3.
- [x] `apps/web/test/` (one new module, for example `todos.tsx`) -- move the copied component-test helpers listed in the Code Map, with DeleteConfirm's `serve` plus EditForm's PATCH `fail` as the one `serve`. Use `Object.assign` in `renderLoaded`, so `list` stays a getter. Keep the fixtures that differ local to their files. Each test file imports what it used, and keeps its local helpers that have no copy elsewhere. -- Item 3.
- [x] `e2e/helpers.ts` and the specs -- move `TODO_PATH`, `isPatch`, `patchAndRefetch` and `regainFocus` into the helpers, and import them in the specs. -- Item 3.
- [x] `apps/api/test/integration/` -- share `storedRows`, `expectValidationProblem(response, path, method, field?)` and `expectNothingLeaked` (one regex covering `select|insert|update|delete`) between `todos.test.ts` and `update-delete.test.ts`. -- Item 3.
- [x] Comments in touched files -- fix any that no longer describe the code (for example the dedupe's "exact text").

**Acceptance Criteria:**
- Given the swept code, when `pnpm typecheck` and `pnpm test` run, then both exit 0, and no existing test's assertions changed.
- Given `pnpm test:all` (caller, under the stack lock), when it finishes, then it exits 0: e2e in desktop, phone and desktop-dark, axe coverage, contract and profile.
- Given the plan's Design Notes, when the story closes, then every deferred finding in scope is listed as fixed or moved to a named place.

## Implementation Notes

**Item 1, one row rule.** `checkAtPlaceOf(list, id, before, ids)` in `TodoList.tsx` is the one rule; the layout effect uses it `?? fallbackTarget()`. Each live card gets `focus={focusFor(id)}`: `nextCheck()` reads `previousIds.current` at call time and drops the card's own id, `targets` is App's `focusTargets`. `TodoCard` takes a `CardFocus` prop with an inert `NO_FOCUS` default (Leaving copies); `checkOf`, `operableSibling` and `addField()` are gone, and `main h1` / the "New todo" label lookup became `targets.heading` / `targets.addField` (the same elements). Equivalence holds as the Design Notes argue: `previousIds` is set at the top of the list's layout effect on every commit, before any early return, so a handler or a settled promise reads the same operable rows, in the same order, as the DOM shows. A card whose row already unmounted still returns early on `itemRef.current === null`, as before.

**Item 2, dedupe by id.** `MutationHelper.lastNotFound(): NotFoundRecord | null` (`{ id, text }`). In `execute`'s failure settle step, after `revert`, `leave` and `recordRevert` and before `announce`, the failure text is computed once into `text`; a `follow-up` whose failure kind is `not-found` records `{ id, text }`, then `announce('failure', text)` runs as before. `failureText` is still evaluated after the revert (edit's `shown()` depends on that), and still once. The record is never cleared: a later announcement changes what shows, which the hook also checks. `useAnnounceDeletedElsewhere()` now takes `{ id, description }` and skips only when the record's id is this todo's and a `failure` with the record's text is showing. The list passes `{ id, description }` from `watched`. No existing announcement test failed, so nothing was reverted.

**Item 3, cleanup.**
- `components/tap-origin.ts` (`useTapOrigin`: `onPointerDown`, `tapped(event)` that reads and clears) replaces the copies in `TodoCard` (card `onPointerDown`, Confirm delete) and `TodoList` (Try again). `TextField.tsx` exports `isComposingKey(event)`, used by `TextField`'s Enter, `EditForm`'s Escape and the card's confirm Escape. The Announcer's own checks were left, per the ledger.
- `apps/web/test/todos.tsx` holds `UNAVAILABLE`/`NETWORK`/`GENERIC`, `gate`, `problem`, `serve` (DeleteConfirm's GET/PATCH/DELETE/POST plus EditForm's PATCH `fail`), `Answer`, `serveLists`, `liveElement`, `check`, `row`, `card` (the `row(name)`-based body; EditForm's `check(name).closest('li')` copy finds the same element), `holdLeaveTimers` (DeleteConfirm's, returning `{ held, run }`; ListStates only uses `run`), `settled`, `regainFocus` and `renderLoaded(names)` (EditForm/DeleteConfirm's, now `Object.assign`, so `list` stays a getter; no test read `list` after its renderLoaded call, so nothing depended on the old spread snapshot). TodoCard's simpler `renderLoaded` (no context, spy or refetch) is replaced by the shared one: same waits, and its extra Probe child and announcer spy are unused there.
- Kept local on purpose: every fixture (`milk`, `rent`, `bills`, `todo`; `rent` differs between files, so none moved), ListStates' `problem` (it returns an answer function, a different helper under the same name), Announcer's `renderLoaded(...later)`, and helpers with no copy elsewhere. The two `editButton`s differ (screen vs within the row) and stay local.
- e2e: `TODO_PATH`, `isPatch`, `patchAndRefetch` and `regainFocus` moved to `e2e/helpers.ts` (the two `regainFocus` bodies were identical; the doc comment merges both). `isDelete` stays in `delete.spec.ts` (one copy).
- API: `apps/api/test/integration/todo-checks.ts` holds `storedRows(db)`, `expectValidationProblem(response, path, method, field?)` and `expectNothingLeaked` with the one regex `/stack|sqlite|select |insert |update |delete |\bat \//i`. `storage.test.ts`'s inline leak regex (already the full one) was not in scope and is unchanged.

**Deviation from the diff check (Verification, third command).** Two shared API helpers need an argument at their call sites, so those hunks are not pure removals: `expectValidationProblem(response, field)` became `expectValidationProblem(response, '/api/todos', 'post', field)` / `(response, TODO_PATH, 'patch', field)` as the plan's signature asks, and `storedRows()` became `storedRows(harness.db)` (the helper can't reach each file's `harness` otherwise). Matchers and expected values are unchanged. The shared leak regex is also stricter than each file's old one (POST bodies are now also checked for `update `/`delete `, PATCH/DELETE bodies for `insert `); all pass.

**New tests.** `EditForm.component.test.tsx`: `K3 a toggle answered 404 on one todo still lets the list announce another todo with the same text that a refetch removes in edit mode` (A and B both "Buy milk"; `listAnnounce` called exactly once with B's message; focus ends on "Pay rent"). Checked that it fails with the old text-only dedupe and passes with the new one. `mutations.test.ts`: `U5 a follow-up answered 404 records its id and the text it announced; other failures and successes record nothing` (a success, a 503, a delete's 404 and an add's 404 record nothing; an edit's 404 records; later non-404s keep it; a toggle's 404 replaces it).

**Surprise.** Re-announcing the identical text ("“Buy milk” was deleted elsewhere." twice in a row) clears the live element for a moment before showing it again, so the new K3 test waits for the text instead of reading it once.

**Files touched.** `apps/web/src/components/{TodoCard,TodoList,EditForm,TextField}.tsx`, new `apps/web/src/components/tap-origin.ts`; `apps/web/src/todos/{mutations,hooks}.ts`; new `apps/web/test/todos.tsx`; `apps/web/src/components/{TodoCard,EditForm,DeleteConfirm,ListStates,Announcer}.component.test.tsx`; `apps/web/src/todos/mutations.test.ts`; `e2e/{helpers.ts,complete.spec.ts,edit.spec.ts,refresh.spec.ts,delete.spec.ts}`; new `apps/api/test/integration/todo-checks.ts`; `apps/api/test/integration/{todos,update-delete}.test.ts`.

**Verified here.** `pnpm typecheck` exit 0; `pnpm test` exit 0 (25 files, 556 tests). `tsc --noUnusedLocals` over `apps/web`, `apps/api` and `e2e` reports nothing. `pnpm test:all` (e2e, axe, contract, profile) not run here: it is the caller's, under the stack lock.

**Caller, after the implementer (step 3).** I undid one part of item 3. `storedRows` is again a local one-liner in `todos.test.ts` and `update-delete.test.ts` (`harness.db.select().from(todos).all()`), and every call site reads `storedRows()` as at baseline. Sharing it meant editing about 30 assertion lines, which goes against the plan's rule that assertions stay as written, and the copy is a single query bound to each file's own harness. `todo-checks.ts` keeps only `expectValidationProblem` and `expectNothingLeaked`. The other lines of this section that mention `storedRows(db)` are out of date where they disagree with this note. Afterwards: `pnpm typecheck` exited 0 and `pnpm test` exited 0 (25 files, 556 tests). `pnpm test:all` under `/tmp/todo-test-stack.lock` exited 0, with every step passing: unit, component, integration, contract, e2e (117 passed across desktop, phone and desktop-dark), axe coverage (117 tests, 156 scans), profile, contract-unavailable and scenario coverage. todo-test was torn down.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 3 findings — high 0, medium 0, low 2, false 1, maybe-false 0
- findings:
  - `[low]` `[reject]` `storedRows` is still copied in both API integration files, while the task and the ledger call item 3 fully shared. — Real: the caller restored the local one-liner (see Implementation Notes, Caller). No harm is named. It is one query bound to each file's own `harness`, and sharing it cost about 30 assertion-line edits against the plan's rule that assertions stay as written. Re-sharing it would undo that. The record is corrected in Implementation Notes, Caller, and the ledger's item 3 stands for the rest of the copied helpers.
  - `[low]` `[reject]` The new same-text K3 test does not prove that the helper announced A, or that B's message came after it. — The behaviour this item changes is pinned down: the list's `announce` runs exactly once, with B's message. The implementer confirmed the test fails under the old text-only dedupe. The helper's A message is covered by the existing U4 and K3 tests. Asserting the order needs a second spy on the helper's own announce reference, which is more than a direct correction, for a gap no user would meet.
  - `[false]` `[reject]` The branch's upstream is `origin/main`, so a push could go to `main`. — Refuted: `push.default` is unset (`simple`), and the reviewer notes that a bare `git push` refuses when the branch names differ. The run pushes with `git push -u origin story-2-7-refactor-sweep`, which also resets the upstream. This is not in the diff.

### 2026-11-25 — Review pass (follow-up, thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- verdicts: 21 findings — high 0, medium 1, low 16, false 4, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind-hunter) `checkAtPlaceOf` maps an id missing from `before` to place 0, so a card could send focus to the top row. — Refuted: a card calls `nextCheck()` only while it is mounted and live. A commit that drops its row, or turns it into a Leaving copy (a new key), unmounts that card instance, so `itemRef.current` is null and `moveFocusOffRow` returns first. `confirmDelete` runs from a click on a rendered live row, which is in the last committed `previousIds`. The refetch path is the baseline code, unchanged.
  - `[low]` `[reject]` (blind-hunter) The optional `focus` prop (default `NO_FOCUS`) would hide a live card rendered without it. — There is one call site, which passes it. The prop follows the existing `edit`/`confirm` defaults pattern. Turning the props into a union keyed on `leaving` is more than a direct correction, for a developer slip nobody has made.
  - `[low]` `[reject]` (blind-hunter) The plan's third Verification command (`--stat`) can't show that hunks only move helpers, and its pathspec leaves out the new helper modules. — Real, but the fix edits this build's plan. The hunks were read in full at step 3 and in both review passes.
  - `[low]` `[reject]` (blind-hunter) The plan record contradicts itself: stale `storedRows(db)` lines, and an Auto Run Result naming only the quick review. — The fix edits this build's plan. The Caller note corrects the `storedRows` lines, and this pass's Auto Run Result supersedes the quick-pass summary.
  - `[low]` `[reject]` (blind-hunter) The superset `serve` makes TodoCard tests hang on a stray POST or DELETE instead of failing. — No TodoCard test sends either. Before, a stray request had no handler and fell through to a network error that the app absorbs, so it did not fail loudly either. A hang at least surfaces as a timeout. Test harness only.
  - `[low]` `[patch]` (blind-hunter) `e2e/offline.spec.ts` still inlines the `visibilitychange` dispatch that is now `regainFocus`. — Fixed: the spec calls `regainFocus(page)` from `helpers.ts`.
  - `[low]` `[defer]` (blind-hunter) More copied e2e blocks remain: the "hold the PATCH" route setup (complete, edit) and the 503 / no-response failure matrix (add-failure, complete, edit, delete, list-states). — Pre-existing duplication this sweep's scope did not name. Sharing it means new parameterised helpers across five specs, more than a direct correction. Deferred.
  - `[low]` `[patch]` (blind-hunter) The shared `renderLoaded` repeats `settled()`'s wait, and `Probe` components are still hand-written in AddForm, Announcer and one TodoCard test. — Fixed the first: `renderLoaded` calls `settled(app.queryClient)`. The AddForm and Announcer Probes are epic-1 code, and the single TodoCard one reads the context at a different moment; all are left as they are.
  - `[low]` `[reject]` (blind-hunter) No direct unit tests for `checkAtPlaceOf`, `useTapOrigin` and `isComposingKey`, or for the dedupe's other branches. — The extracted pieces are pinned through every caller's component and e2e tests (TodoCard K6, EditForm K3, DeleteConfirm K6, ListStates K5, the tap and IME tests). The dedupe branch that matters is the verification-gap row below, patched there.
  - `[false]` `[reject]` (blind-hunter) The Announcer's tap check lacks `detail !== 0`, so a drag-off touch then Enter would send focus to the heading. — Refuted: Dismiss has `onKeyDown={() => (lastPointerType.current = null)}`, so a keyboard activation clears the touch note before the click. This is epic-1 code, not changed here.
  - `[low]` `[reject]` (blind-hunter) The merged leak regex is stricter than each file's old one, and `expectValidationProblem`'s `path` is a plain string. — Stricter only adds refusals, and all pass. A mistyped path fails at once inside `expectDocumented`. Typing it to the documented paths is more than a direct correction.
  - `[low]` `[reject]` (edge-case-hunter) The shared `serve` holds a stray POST or DELETE in TodoCard tests on a gate nothing opens. — Same root cause as the blind-hunter `serve` row; rejected there.
  - `[low]` `[reject]` (edge-case-hunter, claim) The id check also skips the same todo when the helper's call-time text differs from the row's watched text, where the old text check announced. — Real, but it needs the row's text to change through a refetch between the toggle being sent and its 404. The intent's matrix row "Same todo: one message" endorses one message per todo. Contrived, so not worth more than this note.
  - `[low]` `[reject]` (edge-case-hunter, claim) The ticked task says `storedRows` is shared, but it stays local. — carried: same as the quick pass's `storedRows` row; the code there still reads as that row describes.
  - `[medium]` `[patch]` (verification-gap) Nothing pins the "message still showing" half of the id-keyed dedupe. Simplifying it to `notFound?.id === id` would pass every test and silence a reachable loss (404 in edit mode, the refetch fails, Dismiss, a later refetch removes the row). — Fixed: a new EditForm K3 test covers that case. It fails with the simplified check and passes with the current one.
  - `[low]` `[reject]` (intent-alignment a) A second dedupe change: the same todo, with its text changed between the helper's 404 and the removal, is now skipped. — Same root cause as the edge-case claim row; rejected there.
  - `[low]` `[reject]` (intent-alignment b) The same-text K3 test does not observe the helper's A message or the order. — carried: same as the quick pass's K3-ordering row; the test still reads as that row describes.
  - `[low]` `[reject]` (intent-alignment c) The equivalence between the list's `previousIds` and the DOM's operable rows is argued, not pinned in isolation. — No reachable moment where they differ was found: both reflect the last TodoList commit, which renders every row change. Every focus outcome test passes in jsdom and in three browser projects.
  - `[low]` `[reject]` (intent-alignment d) The API helper call sites gained `path` and `method` arguments, against "assertions stay as written". — The plan's own task prescribes that signature. Matchers and expected values are unchanged. Undoing it would mean editing the plan.
  - `[false]` `[reject]` (intent-alignment e) The test harness changed: the superset `serve`, and the Probe and announcer spy in TodoCard tests. — No bad outcome: these are the moved helpers, with every assertion untouched and every test passing.
  - `[false]` `[reject]` (intent-alignment f) `execute`'s settle step body was edited, and `MutationHelper` gained `lastNotFound()`. — No bad outcome: the edit is the record the intent's Approach asks for. The order of revert, leave, `recordRevert` and announce, and the `announce` signature, are kept, as Never requires.

## Design Notes

The two copies already compute the same target. With `before` holding `id` at place `p` and `ids` = `before` without `id`, the place is `p`, so the target is the row after it, else (when `id` was last) the row before it. That is the card's `operableSibling(next) ?? operableSibling(previous)`. `previousIds` is the last committed list of operable ids (`todos` without Leaving ids), which is the same set and order as the DOM's rows without `data-leaving`. It is current whenever a handler or a settled promise reads it.

**Scope ledger** (ticket Decision 2026-11-25; the implementer adds the outcome):
1. Focus-off-a-removed-row rule, two copies → fold into one (this plan). **Outcome: fixed.** `checkAtPlaceOf` in `TodoList.tsx`, handed to each card as `CardFocus.nextCheck`; the card's DOM copy is removed.
2. Dedupe by id → this plan. If any current announcement test fails, revert it and record a new bug. **Outcome: fixed.** `MutationHelper.lastNotFound()` plus the id-keyed check in `useAnnounceDeletedElsewhere`; no existing test failed, nothing reverted, no new bug. New K3 and U5 tests.
3. Cleanup in epic code → the copied test helpers, the tap and composing checks, and stale comments (this plan). **Outcome: fixed.** `apps/web/test/todos.tsx`, `e2e/helpers.ts`, `apps/api/test/integration/todo-checks.ts` (two of the three API helpers; `storedRows` stays a local one-liner, see Implementation Notes, Caller), `useTapOrigin`, `isComposingKey`; the dedupe's doc comment rewritten. Fixtures and ListStates' answer-returning `problem` stay local (they differ).
- Moved, per the Decision: 2.12's Firefox one-step undo → the epic retrospective. 2.2's two undocumented 400s → story 8 (security review). Already settled: 2.1 AC2, 2.3's Empty-panel focus (built by 2.6), and the spine's Deferred line (left for the architect).
- Seen and left, as accepted patterns rather than cleanup: `LEAVE_MS` and `REVERT_FLAG_MS` mirroring their tokens, and the Announcer's own reduced-motion and tap checks, which are epic-1 code with different rules.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: exit 0, the existing tests unchanged and passing, plus the new K3 and U5 tests.
- `git diff <baseline> --stat -- '*.test.ts' '*.test.tsx' e2e` -- expected: every hunk only removes a moved helper, adds an import or adds a new test. No assertion changes.
- `pnpm test:all` (caller, holding `/tmp/todo-test-stack.lock`) -- expected: exit 0.

## Auto Run Result

Status: built.

**Summary.** This sweep closes 2.7's three scope items, without changing behaviour:
- **One focus rule.** The rule that moves focus off a removed row now lives once, as `checkAtPlaceOf` in `TodoList.tsx`. The list's refetch focus move uses it, and so do the card's deleted-elsewhere and Confirm delete moves, through a new `CardFocus` prop. The card also uses App's focus-target refs instead of finding the add field and the heading by DOM query.
- **Dedupe by id.** The "deleted elsewhere" dedupe now compares ids, through `MutationHelper.lastNotFound()`. The one intended change: a todo with the same text as another todo's showing message is still announced.
- **Shared helpers.** The copied helpers now live in one place each: the component-test helpers in `apps/web/test/todos.tsx`, four e2e helpers in `e2e/helpers.ts`, two API checks in `todo-checks.ts`, the tap check in `useTapOrigin`, and the IME key check in `isComposingKey`.

**Files changed.**
- `apps/web/src/components/TodoList.tsx`: the one row-focus rule, `focusFor` for each card, and `useTapOrigin` on Try again.
- `apps/web/src/components/TodoCard.tsx`: the `CardFocus` prop, with its DOM copies of the rule and the lookups removed.
- `apps/web/src/components/tap-origin.ts` (new): tells a tap from a click or a key press.
- `apps/web/src/components/TextField.tsx`, `EditForm.tsx`: `isComposingKey`, shared.
- `apps/web/src/todos/mutations.ts`: records a follow-up's `not-found` and exposes it as `lastNotFound()`.
- `apps/web/src/todos/hooks.ts`: the dedupe keys on the id.
- `apps/web/test/todos.tsx` (new): the shared component-test helpers.
- Five `*.component.test.tsx` files: they import the shared helpers, and EditForm gains the new K3 test.
- `apps/web/src/todos/mutations.test.ts`: the new U5 test for the record.
- `e2e/helpers.ts`, `e2e/{complete,edit,delete,refresh}.spec.ts`: `TODO_PATH`, `isPatch`, `patchAndRefetch` and `regainFocus`, shared.
- `apps/api/test/integration/todo-checks.ts` (new), `todos.test.ts`, `update-delete.test.ts`: `expectValidationProblem` and `expectNothingLeaked`, shared.

**Review (quick, one lens).** 3 findings: 0 patched, 0 deferred, 3 rejected.
- `storedRows` is left local on purpose: re-sharing it would mean editing about 30 assertion lines.
- The K3 test's ordering of A's and B's messages: the changed behaviour is already pinned down, and asserting the order would need more than a direct correction.
- The branch upstream (false): a bare push refuses, and the run's `-u` push resets the upstream.

**Follow-up review recommended:** false. Nothing was patched (high 0, medium 0, low 0).

**Verification.**
- `pnpm typecheck` exited 0.
- `pnpm test` exited 0: 25 files, 556 tests.
- `pnpm test:all` exited 0 under the stack lock: e2e passed 117 tests in desktop, phone and desktop-dark; axe, contract, profile, contract-unavailable and scenario coverage all passed; todo-test was torn down.
- The matrix rows are each covered by tests that ran: the existing TodoCard K6, EditForm K3, DeleteConfirm K6 and ListStates K5 tests, plus the new K3 and U5.

**Residual risks.**
- The API leak check is now stricter than either file's old regex. It passes today.
- The focus rule now reads the list's last committed operable ids rather than DOM siblings. The two are equal by construction (Design Notes), and every focus test passed in jsdom and in three browser projects.

### Follow-up review pass (thorough), 2026-11-25

Status: built. This pass reran the review with the thorough lens set: blind-hunter, edge-case-hunter, verification-gap and intent-alignment.

**Findings.** 21 in total: high 0, medium 1, low 16, false 4.
- **3 patched:**
  - `e2e/offline.spec.ts` calls the shared `regainFocus`.
  - The shared `renderLoaded` calls `settled()`.
  - A new EditForm K3 test pins the "message still showing" half of the id-keyed dedupe. It fails with the check cut down to `notFound?.id === id`, and passes as built.
- **1 deferred:** more copied e2e blocks, the "hold the PATCH" route setup and the 503 / no-response failure matrix. They are pre-existing and outside the named scope; the frontmatter `deferred` entry has the details.
- **17 rejected:** each reason is in the triage log. Two of them are carried from the quick pass: `storedRows` and the K3 ordering.

**Follow-up review recommended:** false. This is a follow-up pass and no high was patched (patched: medium 1, low 2).

**Files changed in this pass:** `e2e/offline.spec.ts`, `apps/web/test/todos.tsx`, `apps/web/src/components/EditForm.component.test.tsx`.

**Verification.**
- `pnpm typecheck` exited 0.
- `pnpm test` exited 0: 557 tests.
- `pnpm test:all` exited 0 under `/tmp/todo-test-stack.lock`, with every step passing. That includes e2e, 117 passed in desktop, phone and desktop-dark. todo-test was torn down.
