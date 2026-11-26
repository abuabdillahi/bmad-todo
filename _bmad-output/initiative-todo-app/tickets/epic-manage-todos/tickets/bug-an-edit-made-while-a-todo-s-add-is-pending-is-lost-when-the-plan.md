---
title: "An edit made while a todo's add is pending is lost when the add fails"
type: bugfix
ticket: '19'
created: '2026-11-26'
status: built
baseline_revision: '7ffb26d7af040b0e6672cdc3a23cba4053c8b1f4'
route: full
route_source: auto
risk: medium
review: thorough
review_source: auto
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      A delete confirmed behind an add that fails with no response but was stored after all comes back on the refetch, silently.
    evidence: |-
      U5 drops follow-ups behind a failed create, so the DELETE is never sent; the settle-time refetch lists the stored todo again. Pre-existing (the same before #70); recorded in the plan's Design Notes but in no EXPERIENCE row, spine Deferred line or backlog ticket.
    location: >-
      apps/web/src/todos/mutations.ts execute() (create failure drops follow-ups)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** When a pending add fails, `AddForm.submit()` restores the text the add sent. Edits saved on the new card meanwhile are queued behind the create, dropped with it (AD-13, U5), and the card ignores `dropped`, so the edited text is lost; a todo deleted meanwhile is also restored into the field, offered for resubmission (#70, retrospective R1, R2).

**Approach:** At a create's failure, before reverting, the helper works out the todo as the user last left it, by applying the follow-ups queued behind that create (up to any resubmitted create) to the create's value. A failed `addTodo` outcome carries that as `latestDescription`: the last edited text, or `null` if a queued delete removed it. The add form restores `latestDescription`, restores nothing when it is `null`, and offers the failed add's id for reuse only when the restored text is exactly the sent text. The helper's AD-13 contract is unchanged: follow-ups are still dropped (not sent, announced or reverted, resolve `dropped`, leave the count), and components still ignore `dropped`.

## Boundaries & Constraints

**Always:** Only an empty add field is filled, newer typing never overwritten; caret to the end when focus is in the field. The add-failure announcement is unchanged and still quotes the sent text. `run()`'s `MutationOutcome` and every follow-up's outcome keep their exact shapes. An Edit form open but not saved when the add fails is still discarded.

**Never:** No change to U5's drop rule, to the add, edit, complete or delete flows when no add fails, to `messages.ts` wording, to the API, or to `TodoCard.tsx`. No edit to the architecture spine (`architecture-todo-app.md`), README.md, `docs/quality/` or `scripts/`. If a change to AD-13's stated contract turns out to be needed, halt instead.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit behind failing add | add "Buy milk" pending; edit saved "Buy oat milk" (one or two edits, with or without a toggle) | add fails: field holds the last edit; failed outcome `latestDescription` is it; PATCH never sent | add failure announced quoting "Buy milk" |
| Delete behind failing add | add pending; delete confirmed (with or without earlier edits) | add fails: field unchanged, nothing restored, id not reusable; list lacks the todo | add failure announced |
| No follow-ups / toggle only | add pending, nothing or only a completion | sent text restored, unchanged resubmit reuses the id; landed-after-all clears only that exact text | as today |
| Restored edited text resubmitted | field holds "Buy oat milk" from a failed add of "Buy milk" | sent with a new id, changed or not | no 409 possible |
| Field not empty at failure | user typed newer text | field untouched | — |

</intent-contract>

## Code Map

- `apps/web/src/todos/mutations.ts` -- the AD-13 helper. `execute()` catch: a create's failure sets `chain.createFailed`, then `settle()` reverts and leaves. `revert()` already re-applies later pending entries' `apply` in order; follow-ups queued behind the create are still in `chain.pending` (they run, and drop, only after this execute resolves). `addTodo()` wraps `run()` and adds `id`. `AddOutcome` type at line 16. `apply` functions are pure (create ignores `prev`; edit/complete return null on undefined; delete returns null).
- `apps/web/src/components/AddForm.tsx` -- `submit()`: on `failed`, restores `description` into an empty field and sets `restored = { id, text }`; `reuse` is the id when the submitted text equals `restored.text`; `useLandedAfterAll` clears the field only when it equals `restored.text`.
- `apps/web/src/todos/hooks.ts` -- re-exports `AddOutcome`; `useAddTodo` passes `addTodo` through. No change expected.
- `apps/web/src/components/TodoCard.tsx` `save()` -- ignores `dropped`; must stay unchanged.
- `apps/web/src/todos/mutations.test.ts` -- `setup()`, `held()`, `flush()`, `problem()`, `heldByMethod()` (edit describe), `heldRequests()` (delete describe); U5 tests at 299, 736, 869 are the patterns to follow. Test titles start with scenario ids (U4, U5, K1, E6...): `scripts/scenario-coverage.mjs` reads them.
- `apps/web/src/components/AddForm.component.test.tsx` -- `describe('AddForm: optimistic add')`: `serve()`, `gate()`, `renderLoaded()`, `items()`, `liveElement()`, `replaying()`, `failAndRestore()`; the app renders the real list and cards (`renderApp`), so the card's Edit and Delete can be driven by role.
- `e2e/add-failure.spec.ts` -- `holdCreate()` and the 503 / no-response matrix; `e2e/helpers.ts` exports `editButton`, `editField`, `deleteButton`, `deleteConfirm`, `todoItem`, `announcement`, `MESSAGES`; `e2e/delete.spec.ts` `confirmButton()` shows the confirm button's name.
- `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md` -- rows "Follow-ups on a failed add" (line ~249) and "Add failed" (line ~265).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/todos/mutations.ts` -- In `execute()`'s catch, for a create, record on its entry, before `revert`/`leave`, the todo as its queued follow-ups leave it: start from the create's `apply`, then apply each later pending entry in order (applied or not, guarding a throwing `apply` as `revert` does) until the next `create`; `null` when removed. Expose it only through `addTodo`: widen `AddOutcome` so a `failed` add also carries `latestDescription: string | null` (fallback: the sent text when nothing was recorded, e.g. the `.catch` path). Keep `run()`'s outcome and all follow-up outcomes byte-identical. Update the doc comments of `AddOutcome` and `addTodo`. -- the helper is the one place that knows the queued follow-ups at the moment of failure.
- [x] `apps/web/src/components/AddForm.tsx` -- On `failed`: if `latestDescription` is `null`, return without touching the field or `restored`; otherwise restore `latestDescription` into an empty field as today (caret, `clearError`), and set `restored` only when it equals the sent text, so a restored edited text never lends the failed id. Update comments. -- AC1-AC4.
- [x] `apps/web/src/todos/mutations.test.ts` -- U5 tests: an edit (and two edits plus a toggle) queued behind a failing create: the add outcome's `latestDescription` is the last edit, the follow-ups resolve `dropped`, no PATCH sent, one announcement; a delete (and edit then delete) behind a failing create: `latestDescription` is `null`; no follow-ups: it is the sent text. U4/U5 tests pinning the final list for a delete beside a failing edit, and beside a failing completion, of the same existing todo, both orders (delete succeeds 204, the other fails 503): the todo stays absent and the pending count is 0.
- [x] `apps/web/src/components/AddForm.component.test.tsx` -- K1 tests: add held, Edit the new card to "Buy oat milk" and Save, fail the add: field "Buy oat milk", caret at end, announcement quotes "Buy milk"; resubmitting it sends a new id (and a second submit after changing it too). Add held, Delete then confirm, fail the add: field stays empty and the list lacks it; a later typed "Buy milk" gets a new id. The new edit and delete tests must fail on the baseline code.
- [x] `e2e/add-failure.spec.ts` -- E6 E8 tests for the reproduction, at least with a 503: an edit saved while the add is held comes back in the field when it fails (no PATCH sent); a delete confirmed while it is held leaves the field empty and the todo absent. Scan with `expectNoAxeViolations`.
- [x] `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md` -- Update "Add failed" (the field gets the todo's latest text: the sent text, or the last edit saved on its card while the add was pending; nothing if the user deleted it; a restored edited text is always sent with a new id) and "Follow-ups on a failed add" (still dropped, but a saved edit's text returns to the add field via the add's outcome, a delete means nothing returns), each with a dated line "2026-11-26, #70 (po Decision)".

**Acceptance Criteria:**
- Given a todo whose add is pending and an edit saved on its card meanwhile, when the add fails with a 503 or no response, then the empty add field shows the last edited text with the caret at its end, the add failure is announced as today, and no PATCH is sent.
- Given a todo whose add is pending and its delete confirmed meanwhile, when the add fails, then the add field is left as it was, the list does not show the todo, and a later submit of the sent text gets a new id.
- Given a failed add with no follow-ups or only a toggle, when it fails, then the sent text is restored only into an empty field, resubmitting it unchanged sends the failed add's id, and Add landed after all clears the field only while it holds exactly that text.
- Given the add field holding a restored edited text, when it is submitted, changed or not, then the POST carries a new id.

## Implementation Notes

- `mutations.ts`: `run()` now delegates to an internal `enqueue(spec)` that returns `{ entry, outcome }`, so `addTodo` can read its own entry after the outcome resolves; `run()`'s outcome and every follow-up's outcome are unchanged. `execute()`'s catch, for a create, sets `entry.latest = latestAfter(entry, chain)` before `settle()` (so before `revert`/`leave` and before the queued follow-ups run and drop). `latestAfter` starts from the create's `apply(undefined)` and applies every later pending entry in order, applied or not, stopping at the next `create`, guarding a throwing `apply`; it returns null when the value ends undefined. `AddOutcome` is now a union: non-failed outcomes `& { id }`, failed `& { id; latestDescription: string | null }`; with nothing recorded (the `run` `.catch` path) `latestDescription` falls back to the sent text. `hooks.ts` needed no change.
- `AddForm.tsx`: on `failed`, `latestDescription === null` returns at once (field and `restored` untouched; `restored` is already null since submit cleared it); otherwise restores it into an empty field as before, and sets `restored` only when it equals the sent text, so an edited text never lends the failed id and is never cleared by Add landed after all. An edit saved back to exactly the sent text counts as the sent text (reuses the id), which is correct: the body is identical.
- Tests: `mutations.test.ts` adds U4 (no follow-ups: sent text, exact outcome shape), U5 edit / two edits + toggle (last edit), U5 delete / edit-then-delete (null, `it.each`), the toggle-only U5 test now asserts `latestDescription: 'Buy milk'`, and U4 U5 delete-beside-failing-edit/completion in both orders (4 cases). `AddForm.component.test.tsx` adds K1 edit-behind-failing-add (unchanged and changed resubmit, `it.each`, both send a new id) and K1 delete-behind-failing-add (field stays empty, later "Buy milk" gets a new id), with a `recordFollowUps()` MSW helper asserting no PATCH/DELETE. `e2e/add-failure.spec.ts` extracts the failure matrix to `FAILURES` and adds, for both 503 and no response, an edit test and a delete test, each scanned with `expectNoAxeViolations`; they wait for the settle-time list refetch before asserting the field.
- `EXPERIENCE.md`: "Follow-ups on a failed add" and "Add failed" rows updated with the dated "2026-11-26, #70 (po Decision)" line; frontmatter `updated` bumped to 2026-11-26.
- Verification: `pnpm typecheck` clean; `pnpm test` 28 files / 804 tests pass. With baseline `mutations.ts` and `AddForm.tsx` (stashed), 9 of the new/changed tests fail (all the new edit and delete tests at unit and component level, plus the no-follow-ups and toggle-only `latestDescription` assertions); the delete-beside-edit/completion tests pass on baseline, as expected (they pin existing behaviour). e2e not run here (orchestrator runs `pnpm test:all`).

## Plan Change Log

## Review Triage Log

### 2026-11-26 — Review pass
- verdicts: 24 findings — high 0, medium 1, low 17, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) EXPERIENCE "Add landed after all" wording reads as if a restored edited text would clear — patched in the "Add failed" row (the two rows the po Decision names): a restored edited text is never cleared by Add landed after all.
  - `[medium]` `[defer]` (blind) A delete confirmed behind an add that fails with no response but landed: the dropped delete was never sent, so the refetch shows the todo again, silently — pre-existing (U5 drops it; today's code does the same), answered in Design Notes; deferred.
  - `[low]` `[patch]` (blind) No test pins the landed-after-all answer for a restored edited text — added component test "K1 an edited text restored after a failed add is never cleared when the add landed after all".
  - `[low]` `[patch]` (blind) test-strategy.md K1 still says a failed add restores the sent text — K1 clause corrected with a dated note.
  - `[false]` `[reject]` (blind) The AD-13 spine note is not tracked — the ticket requires the plan to record the new shape and propose the note through `bmad-architecture`, not the build; Design Notes carry the proposed wording.
  - `[low]` `[patch]` (blind) EXPERIENCE "Add failed" says "quoting the text", ambiguous once the field holds an edit — now "quoting the sent text".
  - `[low]` `[reject]` (blind) A completion toggled while the add was pending is not kept on resubmit, undocumented — the ticket's AC1 restores text "with or without a completion toggle"; the add field can only hold text, and the toggle-only case behaves as before this change.
  - `[low]` `[patch]` (blind) New e2e tests titled E6 E8 use mouse clicks; E8 means keyboard alone — `E8` dropped from the two new titles (four generated tests).
  - `[low]` `[reject]` (blind) Mixed-call tests pin only list and pending count, not announcements — AC5 asks for the final list state; mixed-call announcement wording belongs to A10's backlog ticket.
  - `[low]` `[reject]` (blind) `latestAfter`'s break at a resubmitted create, and the `entry.latest === undefined` fallback, are untested — the break is unreachable from the UI (the form resubmits only after the failed outcome resolves); the fallback runs only when `settle`/`announce` throws, and then restores the sent text as before this change.
  - `[low]` `[reject]` (blind) `latestAfter` repeats `revert()`'s fold — a shared fold is a refactor, not a direct correction; no named caller would diverge today.
  - `[low]` `[reject]` (edge) Outer `.catch` path (settle throws) gives `latestDescription` = sent text even with a queued delete — same as the fallback row: needs the announcer to throw; behaviour equals the pre-change restore.
  - `[low]` `[reject]` (edge) Edited text restored, add landed after all: the landed todo keeps the pre-edit text and resubmitting adds a second todo — the build's recorded answer to the ticket's open question; clearing would lose the edit again, and a changed-text resubmit is the spine's accepted v1 risk.
  - `[low]` `[reject]` (edge) `latestAfter` computes `completed` but it is discarded — same as the completion row above: text only, by AC1.
  - `[false]` `[reject]` (intent) "No response" covered only in e2e — the e2e tests run both the 503 and no-response cases and passed in `pnpm test:all`.
  - `[low]` `[reject]` (intent) Toggle/earlier-edit mixes are observed only at helper level — the helper computes the value; the form restores whatever it carries, covered by the component edit/delete tests.
  - `[low]` `[reject]` (intent) No form-level toggle-only test — the form path is identical to no follow-ups (`latestDescription` equals the sent text, unit-tested); the existing K1 restore tests cover the form.
  - `[false]` `[reject]` (intent) AC4's no-409 not checked against the real API — a new id cannot meet AD-6's same-id/different-text 409; the component test proves the new id.
  - `[low]` `[reject]` (intent) Crossed-kinds tests use 503 where a real PATCH after a DELETE would get 404, and omit a failing delete — AC5 pins the final list for a delete beside a failing edit/completion, which the four cases do.
  - `[low]` `[reject]` (intent) AC2's "left as it was" is tested only on an empty field — the form returns before reading or writing the field when `latestDescription` is null.
  - `[low]` `[patch]` (intent) Open-question answers not pinned by tests — grouped with the landed-after-all row above; same added test.
  - `[false]` `[reject]` (intent) Widening `AddOutcome` might be the AD-13 change the po Decision halts on — AD-13's stated rules (outcomes ok/failed/dropped, dropped follow-ups unsent, unannounced, unreverted, ignored by components) are unchanged; only `addTodo`'s outcome, already widened with `id` in story 1, gains a field for the local reaction AD-13 names.
  - `[false]` `[reject]` (intent) Editing EXPERIENCE.md contradicts the earlier Assumption — the later po Decision of 2026-11-26 directs this story to update the two rows.
  - `[false]` `[reject]` (intent) The restored edit text is not re-cleaned — the Edit form submits through the same `useTextField.submitValue()` / `prepareDescription()` as the add field, so it is already cleaned.

## Design Notes

Open questions from the ticket, answered:
- **Landed after all, with an edited text restored:** the field is left alone. `restored` is not set for an edited text, so the refetch that lists the old text does not clear it; the user's edit lives only in the field, and clearing it would lose it again. Resubmitting can add a second todo: the spine's existing accepted v1 risk for changed text.
- **Landed after all, with a dropped delete:** the delete was never sent (U5), so the refetch shows the todo again. Nothing more is done: the user sees it and can delete it again; fixing it would mean sending a dropped follow-up, which AD-13 forbids.
- **AD-13:** its stated contract (outcomes `ok` / `failed` with `FailureKind` / `dropped`; dropped follow-ups not sent, announced or reverted; components ignore `dropped`) is unchanged. Only `addTodo`'s `AddOutcome`, already extended with `id` in story 1, gains `latestDescription` on failure, used for the local reaction AD-13 names ("restoring a failed add's text"). Proposed spine note for `bmad-architecture` (not made by this build): "A failed create's promise also carries the todo's text as its queued follow-ups left it, or null if one deleted it."

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors.
- `pnpm test` -- expected: all unit, component and integration tests pass, including the new ones; the new edit and delete tests fail when run against the baseline `mutations.ts` and `AddForm.tsx`.
- With `/tmp/todo-test-stack.lock` held: `pnpm test:all` (run at Verify by the orchestrator, not the implementer) -- expected: every step passes, including the new e2e tests, and todo-test is down at the end.

## Auto Run Result

- **Summary:** A failed add now gives back the todo as the user last left it. At a create's failure, before the revert and the drop, the helper applies the follow-ups queued behind it to the create's value; `addTodo`'s failed outcome carries the result as `latestDescription` (the last edit, or null after a confirmed delete). The add form restores it into an empty field, restores nothing after a delete, and lends the failed id only to the unchanged sent text. AD-13's stated contract is unchanged (follow-ups still dropped: not sent, announced or reverted; `run()` and follow-up outcomes identical; `TodoCard` untouched).
- **Files changed:**
  - `apps/web/src/todos/mutations.ts` -- `latestAfter()`, `enqueue()`, `AddOutcome` union with `latestDescription` on failure.
  - `apps/web/src/components/AddForm.tsx` -- restores `latestDescription`; nothing on null; id reuse only for the sent text.
  - `apps/web/src/todos/mutations.test.ts` -- U4/U5 outcome tests for edit, edits plus toggle, delete, edit then delete; four crossed-kinds list-state tests.
  - `apps/web/src/components/AddForm.component.test.tsx` -- K1 edit-behind-failing-add (unchanged and changed resubmit), delete-behind-failing-add, edited text not cleared when landed after all.
  - `e2e/add-failure.spec.ts` -- E6 reproduction tests (edit and delete, 503 and no response) with axe scans.
  - `_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md` -- "Add failed" and "Follow-ups on a failed add" rows, dated 2026-11-26, #70 (po Decision).
  - `_bmad-output/initiative-todo-app/test-strategy.md` -- K1's failed-add clause.
- **Review findings:** 24 (thorough: blind-hunter 11, edge-case-hunter 3, verification-gap 0, intent-alignment 10). Patched 6 rows (5 entries, all low): EXPERIENCE wording (2), landed-after-all test (2 rows, grouped), test-strategy K1, E8 title prefix. Deferred 1 (medium, pre-existing: a dropped delete reappears when the add landed after all). Rejected 17 with reasons in the Review Triage Log (6 false, 11 low).
- **Follow-up review recommended:** false (patched: high 0, medium 0, low 5 entries).
- **Verification:** `pnpm typecheck` clean; `pnpm test` 805 passed; 9 new/changed tests fail on the baseline helper and form (implementer's stash check). `pnpm test:all` under `/tmp/todo-test-stack.lock`, twice (before and after the review patches): every step passed, e2e 129 passed, todo-test down at the end.
- **Residual risks:** the proposed AD-13 spine note (Design Notes) still needs `bmad-architecture`; the deferred dropped-delete case; e2e delete test's timing around the leaving row (passed twice).
