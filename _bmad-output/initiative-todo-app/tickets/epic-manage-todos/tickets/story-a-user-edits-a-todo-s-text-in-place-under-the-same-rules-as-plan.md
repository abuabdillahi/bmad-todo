---
title: "A user edits a todo's text in place, under the same rules as the add field"
type: feature
ticket: '4'
created: '2026-11-25'
status: built
baseline_revision: '0a34aa42a0be723676d9751623ea095eafff95ac'
route: full
route_source: auto
risk: high
review: thorough
review_source: auto
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A todo's text can't be changed after it is added (R13). The card has no Edit button, and the add field's text rules (cleaning, counter, inline error, Field status, Enter and composition handling) live inside `AddForm.tsx`, so an edit field would have to copy them.

**Approach:** The add field's rules move into one shared text field (`TextField.tsx`), which the add form and a new Edit form both use. The card gets DESIGN.md's Edit button. It swaps the row in place for the Edit form. Save or Enter commits through AD-13's helper as a `follow-up` calling `PATCH /api/todos/{id}` with `{ description }`. Cancel or Escape discards, unchanged text sends nothing, and a failed save reverts with the `edit` message and keeps its draft for the next Edit. The list area owns which row is editing and the per-todo draft map. When a refetch removes the row being edited, it announces `deletedElsewhere`.

## Boundaries & Constraints

**Always:**
- Components change todos only through hooks in `apps/web/src/todos/` (AD-11), and the edit only through the one helper (AD-13).
- An edit behind a pending create waits for it, and is dropped if the create fails.
- Every message comes from `messages.ts` (`lead.edit`, `deletedElsewhere`, `inline.*`, `hintEdit`), quoted with `quote()`. A successful edit announces nothing.
- The request body and the optimistic todo carry the same cleaned, trimmed value (AD-8).
- The add form keeps its exact DOM order, names, describedby, messages and behaviour (K1, E1 and E6 add tests).
- Hand-off order (EXPERIENCE Interaction Primitives): on entering or leaving edit, focus reaches its target in the same task as the swap, with `flushSync`, and never rests on `<body>`.
- All styling comes from tokens in `tokens.css`. Motion uses only opacity, under `prefers-reduced-motion: no-preference`.
- Test titles lead with scenario ids. Every e2e test keeps an axe scan.
- Implementer shell: put node 26.13.1 (`$HOME/.nvm/versions/node/v26.13.1/bin`) on `PATH` and run only `pnpm typecheck` and `pnpm test`. `pnpm test:all`, Playwright and every docker command are the caller's to run, under the shared todo-test stack lock.

**Never:**
- No Delete button, Delete confirm, edit/confirm exclusivity, Empty panel, or loading or error panel (stories 5 and 6).
- No fix for #30 (Shift+Enter over an IME) or #29 (multi-line drop undo): the shared field keeps today's behaviour exactly.
- No toast, saving indicator or new live region beyond the edit field's one Field status (AD-14).
- No new `FailureKind` or problem type.
- No change to the API, `packages/contract`, `openapi.json`, nginx, compose or CI.
- No test-only switch in app code. No e2e failure injection other than `page.route`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open | Edit pressed (click, tap, Enter or Space) | The row swaps at once to the Edit form. The field holds the saved text (or the kept failed draft, which is then consumed), all selected, with focus in it. The check stays and toggles, named by `aria-label` = saved text. Card takes the active treatment, no chip. | none |
| Save changed | Valid text that differs from the cached description after cleaning and trimming; Save or Enter | Closes at once and shows the new text before the server answers. Focus goes to that row's Edit button (named by the new text). `PATCH {"description": <trimmed>}` is sent. Nothing is announced. | none |
| Save unchanged | Trimmed draft equals the current cached description | Closes, focus on Edit, nothing sent | none |
| Cancel | Cancel, or Escape with focus anywhere in the form (not mid-composition) | Closes, the saved text is shown, focus on Edit, nothing sent | none |
| Invalid | Empty after cleaning, or more than 200 code points | Nothing is sent and the form stays open with focus in the field. Empty: red edge, "Enter a description." inline, `aria-invalid`. Over: the over counter. The Field status is cleared and set again with the reason. | inline only, never the Announcer |
| Save fails | PATCH answers 503, 500, 400, a non-problem error, or no response (15 s write timeout) | The text reverts and the revert flag shows. Focus is not moved. The sent text is kept as this todo's draft until reload. The next Edit opens with it, and Cancel then shows the saved text. | `Couldn't save your edit, so “{pre-edit}” is back as it was.` plus the reason (`Keep it to 1–200 characters.` only for a 400 naming `description`) |
| Not found | PATCH answers 404 | Reverted and flagged. If focus is in the row, it moves when the promise resolves: next row's check, else previous row's, else the list. The row goes on the refetch. | `“{pre-edit}” was deleted elsewhere.` (helper) |
| Behind a pending create | Card added, POST unanswered, edited and saved | New text shows at once. The PATCH is sent after the POST settles. | Create fails: the edit is dropped (not sent, announced or reverted). The card goes, and only the add failure is announced. |
| Vanishes while editing | A refetch drops the todo whose row is in edit mode | Edit closes, the open draft is discarded, and the row unmounts. If focus was in the row, it moves by the after-delete rule (next check, else previous, else the list). | List area: `deletedElsewhere`, kind `failure`. Skipped if the same failure message is showing, or if the row went by a helper revert (a failed create) |
| Text changes on refetch | Edited elsewhere while this row is in edit mode | The open draft is kept, and Save overwrites | none |
| Second Edit | Edit on another row while one is open | The open one closes silently, its open draft lost. Focus goes to the new row's field. | none |

</intent-contract>

## Code Map

- `apps/web/src/components/AddForm.tsx` -- holds today, inline: `useAutoGrow`, `useFieldStatus`, the paste and `beforeinput` native listeners, `clean`/`update`/`handleChange`/composition end, selection restore, the over-limit crossing effect, `refuse`/`submit` validation, `handleKeyDown`, the counter, Inline error, hint and Field status markup. Add-only: `restored`, `caretToEnd`, `valueRef`, `useLandedAfterAll`, the id reuse, `useAddTodo`, the "New todo" label, the row with the Add button.
- `apps/web/src/components/AddForm.module.css` -- field, counter and inline-error classes (`.field`, `.fieldInvalid`, `.textarea`, `.footer`, `.counter*`, `.inlineError*`) move to the shared field module. `.form`, `.label`, `.row` and `.add` stay.
- `apps/web/src/components/description-input.ts` -- `replaceForbidden`, `prepareDescription`, `countCodePoints`. Reuse, don't change.
- `apps/web/src/todos/mutations.ts` -- `MutationHelper` with `run`, `addTodo`, `setCompleted`. Add `editDescription` like `setCompleted`. Don't change `run`, `execute`, `revert` or `settle`.
- `apps/web/src/todos/hooks.ts` -- `useSetCompleted`, `useRevertedAt`, `useTodosStore`, `useAnnouncer`. Add `useEditDescription` and `useAnnounceDeletedElsewhere`.
- `apps/web/src/todos/messages.ts` -- `lead.edit`, `deletedElsewhere`, `inline.hintEdit` already exist. Read only.
- `apps/web/src/components/TodoCard.tsx` -- `li` › `.body` › `.card` › (`.check`, `.content`). Keep `li` › `.body` › `.card`, because `e2e/complete.spec.ts` `cardLayers` and the component test's `card()` walk it. Also has the 404 focus move in `toggle()` (reuse it for edit), `useRevertFlag`, and `REVERT_FLAG_MS`.
- `apps/web/src/components/TodoCard.module.css` -- the card, check, chip, done layers and flag. Uses the 768px breakpoint literal, as `App.module.css` does. Tokens are `--card-button-*`, `--edit-button-*`, `--save-button-*`, `--cancel-button-*`, `--card-button-done-*`, `--edit-form-gap`, `--completion-check-nudge-edit`, `--todo-card-check-row-nudge-wide`, `--motion-duration-swap` and `--motion-press-scale`.
- `apps/web/src/components/TodoList.tsx` -- the one `['todos']` observer. It renders `<ul role="list" aria-label="Todos" tabIndex={-1}>` and the cards.
- Tests to extend or copy:
  - `apps/web/src/todos/mutations.test.ts`: `setup`, `held`, `flush`, `problem`, the `setCompleted` cases.
  - `apps/web/src/components/TodoCard.component.test.tsx`: `serve` with gated PATCH, `gate`, `liveElement`, `renderLoaded`, `check`, `row`, `card`.
  - `apps/web/src/components/AddForm.component.test.tsx`: the paste, tab and composition cases, `NOT_STATUS`, `addFormStatus`.
- Row-text readers that the new "Edit" label breaks:
  - `AddForm.component.test.tsx` `items()` (line ~355).
  - `Announcer.component.test.tsx` line ~93 (`item.textContent`).
  - `e2e/todos.spec.ts` E1's `getByRole('listitem').first()).toHaveText(description)`.
  - `TodoCard.component.test.tsx` K6 tab order (check → next check becomes check → Edit → next check).
- `e2e/helpers.ts` -- `completionCheck`, `todoItem`, `announcement` (excludes `form [role="status"]`, so the edit form's Field status is excluded too), `fieldStatus`, `MESSAGES`, `createTodo`, `resetList`, `visibleText`. `e2e/complete.spec.ts` has the held-PATCH pattern, `patchAndRefetch`, `tabToOnlyCheck` and a deleted-elsewhere test. `e2e/refresh.spec.ts` has `regainFocus` (a `visibilitychange` refetch).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/components/TextField.tsx`, `TextField.module.css` (new) -- move the add field's rules out of `AddForm.tsx` unchanged into `useTextField` plus two render pieces (Design Notes), and move the field CSS out of `AddForm.module.css` -- R13, AD-8, ticket Decision (one implementation).
- [x] `apps/web/src/components/AddForm.tsx`, `AddForm.module.css` -- use the shared field. Keep only the add-specific logic. The rendered DOM, ids and order are as today -- K1, E1.
- [x] `apps/web/src/todos/mutations.ts`, `hooks.ts` -- add `editDescription(todo: Pick<Todo,'id'|'description'>, description: string)`: `run({ id, kind: 'follow-up', apply: prev => prev ? { ...prev, description } : null, send: () => updateTodo(id, { description }), failureText })`. `failureText` returns `deletedElsewhere(todo.description)` for `not-found`, else `failureMessage('edit', failure, todo.description)`. No `successText`. Add hooks `useEditDescription()`, and `useAnnounceDeletedElsewhere(): (description) => void`, which skips when the announcer already shows that exact text with kind `failure` -- AD-13, AD-14.
- [x] `apps/web/src/components/EditForm.tsx`, `EditForm.module.css` (new) -- the Edit form: a `<form>` with the visually hidden label "Edit description", the shared field (hint `messages.inline.hintEdit`), then Save (`type="submit"`) and Cancel (`type="button"`). It focuses the field and selects all on mount (`useLayoutEffect`), and cancels on Escape (not while composing) from anywhere in the form. A valid submit calls `onSave(prepared)` -- R13, AD-8.
- [x] `apps/web/src/components/CardButton.module.css` (new) -- the shared card button: base, soft (Edit, Cancel), primary (Save), done-card variant, hover under `(hover: hover)`, pressed, press scale under no-preference, and 44/40 px min-height by breakpoint (DESIGN.md Card buttons). Story 5 adds its danger variants here.
- [x] `apps/web/src/components/TodoCard.tsx`, `TodoCard.module.css` -- the new markup, the Edit button, edit mode, the save flow, the not-found focus move shared with `toggle()`, the phone and wide layouts, the edit-mode check nudge, and the swap fade (Design Notes) -- R13, R7, R8.
- [x] `apps/web/src/components/TodoList.tsx` -- owns `editingId` and the draft map, passes each card its edit props, announces a vanished edit row, and moves focus off a removed focused row (Design Notes) -- AD-14, EXPERIENCE Focus management.
- [x] `apps/web/src/todos/mutations.test.ts` -- through `helper.editDescription`:
  - U4: applies at once and sends `{description}`, announcing nothing. A failure reverts only that todo's text, records the revert and announces the edit lead with the pre-edit text plus the reason. A 400 naming `description` gets the validation reason. A 404 announces `deletedElsewhere`.
  - U5: an edit behind a pending create is sent after it, and is dropped when the create fails.
- [x] `apps/web/src/components/EditForm.component.test.tsx` (new; through `renderApp` and MSW, reusing `TodoCard.component.test.tsx`'s server pattern) -- one test or more per I/O Matrix row:
  - K3: open, save changed at once before the server answers (gated PATCH, body checked), save unchanged sends nothing, Cancel, Escape, empty, over-limit (one Field status speech on crossing, sends nothing, then speaks again on a second blocked Save), a pasted line break or tab shows as a space, and the counter counts the cleaned, trimmed text.
  - Save fails: revert, message, flag, and focus not moved. The next Edit opens with the draft, and Cancel shows the saved text.
  - 404: focus moves to the next check.
  - Vanishes while editing: announced once, focus to the next check (or the list), no announce after a failed create, no second announce after a toggle 404.
  - Text changes on refetch: the draft is kept.
  - Second Edit closes the first.
  - K6: Edit named `Edit “{full text}”` with the text beyond 40 characters; Tab order check → Edit → next check; in edit mode, check → field → Save → Cancel. The field is named "Edit description" and described by counter and "Press Enter to save.". The check's name in edit mode is the saved text. Right after each of Edit, Save, Cancel and Escape, with nothing awaited in between, `document.activeElement` is the target.
- [x] `AddForm.component.test.tsx` `items()`, `Announcer.component.test.tsx` line ~93, `TodoCard.component.test.tsx` K6 tab order -- read each row's todo text (the span the check's `aria-labelledby` names) instead of the row's whole `textContent`, and expect the Edit button between checks. No other test change.
- [x] `e2e/helpers.ts` -- add `editButton(page, description)` (exact name `Edit “{description}”`), `editField(page)` (textbox "Edit description"), `MESSAGES.editFailed(t, reason)` and `MESSAGES.validation` (`Keep it to 1–200 characters.`).
- [x] `e2e/todos.spec.ts` -- E1's first-row check asserts that row's completion check is named exactly `description`. Nothing else changes.
- [x] `e2e/edit.spec.ts` (new, `beforeEach` `resetList`) -- AD-20:
  - (a) `E4 E7 E8` by keyboard. A todo is set up through the API. Tab to its Edit, Enter: the field is focused with all text selected. Type new text and press Enter while `page.route` holds the PATCH: the check's name is the new text and focus is on the new Edit. Release, then reload: still the new text. Edit, then Escape: unchanged, focus on Edit, no PATCH sent. Axe scans in edit mode and after the save.
  - (b) `E4 E7` by pointer. Click (desktop) or tap (phone) Edit, fill, click or tap Save. It persists after a reload.
  - (c) `E6 E8` empty Save: "Enter a description." is visible, no PATCH is sent, focus stays in the field, axe scan.
  - (d) `E6 E8` × {503 `UNAVAILABLE_BODY`, `route.abort()`}: the text reverts, the banner shows `editFailed`, and focus stays on Edit. Edit then opens with the failed draft. After `unroute`, Enter saves it. Axe scan.
  - (e) `E6 E8` deleted elsewhere while editing: the todo is deleted through `request.delete`, then `regainFocus`. The banner says it was deleted elsewhere, the row is gone and the other todo stays.

**Acceptance Criteria:**
- Given the test profile with a todo, when a user Tabs to its Edit button, presses Enter, types new text and presses Enter, then the new text shows before the save answers, in the desktop, phone and desktop-dark projects, and still shows after a reload. Edit then Escape changes nothing, and an empty Save shows "Enter a description." and sends nothing.
- Given the api is unreachable, when a user saves an edit, then the text reverts with the banner message, and the next Edit opens with the failed draft.
- Given the add form, when the existing K1 tests and the E1 and E6 add e2e tests run, then they pass, with only the row-text reads listed above adapted.
- Given `pnpm test:all` (run by the caller under the stack lock), when it finishes, then it exits 0, axe coverage passes, and `coverage/scenarios.md` lists passing K3 and E4 tests.

## Implementation Notes

**Files touched**
- New: `apps/web/src/components/TextField.tsx`, `TextField.module.css`, `EditForm.tsx`, `EditForm.module.css`, `CardButton.module.css`, `EditForm.component.test.tsx`; `e2e/edit.spec.ts`.
- Changed: `AddForm.tsx`, `AddForm.module.css`, `TodoCard.tsx`, `TodoCard.module.css`, `TodoList.tsx`, `todos/mutations.ts`, `todos/hooks.ts`, `todos/mutations.test.ts`; the row-text readers in `AddForm.component.test.tsx` (`items()`), `Announcer.component.test.tsx` (line ~93) and the K6 tab-order test in `TodoCard.component.test.tsx`; `e2e/helpers.ts`, `e2e/todos.spec.ts` (E1, both first-row reads), `e2e/validation.spec.ts` (see Surprises).

**Decisions**
- `useTextField` is the add field's code moved over unchanged (autogrow, Field status, paste and `beforeinput` listeners, `clean`/`update`/composition end, selection restore, crossing effect, `refuse`, Enter handling). `submitValue()` is the old `submit()`'s validation half. It also exposes `id` (for the `<label>`) and a `view` object the two render pieces read. `TextFieldBox` takes an optional `contentClassName`, which goes on the textarea and footer only, never on the `.field` box, for the swap fade. The add form's DOM, ids, describedby and messages are as before; all 34 AddForm tests pass unchanged apart from `items()`.
- The Edit form cancels on Escape from a form-level `onKeyDown` (skipped while `isComposing` or keyCode 229). It focuses and selects in a mount `useLayoutEffect`.
- Card: `initial` lives in card state, set together with `open()` inside one `flushSync` in the Edit handler (never during render). `closeEdit()` = `flushSync(close)` then focus Edit. `save()` closes first, compares with the cached `todo.description`, then calls the helper. On `failed` it keeps the draft (for `not-found` too, which is harmless), and on `not-found` it runs `moveFocusOffRow()`, now shared with `toggle()`. The "back from edit" fade uses a `leftEdit` state set during render (the derive-state-from-props pattern), so nothing fades on first load.
- Edit-mode check: `aria-labelledby` is swapped for `aria-label` = saved text. The card drops `done` and gains `editing` while editing.
- CardButton classes are `.button` plus one of `.soft` (Edit), `.cancel`, `.primary` (Save) or `.done` (Edit on a done card). Each variant reads its own component tokens (`--edit-button-*`, `--cancel-button-*`, `--save-button-*`, `--card-button-done-*`).
- List area, focus tracking: `onFocus` records the focused row's `data-todo-id`. `onBlur` clears it only when focus moved outside the list, or, with no `relatedTarget`, when a microtask later finds the element still connected and no longer active (focus went to nothing). A removed element, or a window blur, keeps the record, so this works whether or not the engine fires blur on removal (Chrome does, jsdom doesn't). The focus move uses `Math.min(index, ids.length - 1)` on the new ids (the row now at its index, else the last one before it), else the `<ul>`. It is declared before the vanish effect, so it runs first.
- **Vanished edit row, deviation in mechanism (same intent):** the layout effect records `{ id, description, revertedAt }` only when `todos` or `editingId` changes (deps `[todos, editingId]`), not on every commit. `revertedAt` is read from `useTodosStore()` in that render. Why: the list re-renders on every store change (via `useListState`), and the store notifies synchronously while TanStack notifies observers on a `setTimeout(0)`. If the store-only commit ever landed before the cache commit, an "every commit" record would already hold the new `revertedAt`, and a failed create would read as unchanged and be announced. Recording only on list changes makes a failed create's revert always read as changed. Today both land in the same commit anyway, because `useQuery` reads the observer's result, which `setQueryData` updates synchronously. Mutation checks confirmed both guards are load-bearing: dropping the `revertedAt` comparison fails the failed-add test, and dropping the focus move fails the three vanish tests.
- `useAnnounceDeletedElsewhere` skips when the announcer's current message has kind `failure` and exactly that text. Otherwise it calls `announcer.announce('failure', ...)`.

**Surprises**
- `e2e/validation.spec.ts` has three whole-row `todoItem(...).toHaveText(...)` reads (lines ~74, ~127, ~153) that the plan's list of row-text readers missed. The new visible "Edit" label would break them (`"…Edit"`). I changed them the same way as E1 (`todoItem(...).getByRole('checkbox')` `toHaveAccessibleName(...)`), so `pnpm test:all` can pass. This is the only test change beyond the plan's list.
- `e2e/complete.spec.ts`'s deleted-elsewhere test Tabs up to 4 times to reach the second check. With Edit between checks, that now takes exactly 4 presses from the add field (Add, check, Edit, check), so it still fits. Unchanged, but there is no slack left.
- `node_modules` was missing in this worktree. I ran `pnpm install --frozen-lockfile --prefer-offline` (no lockfile change).
- `apps/api/test/integration/logs.test.ts` failed once in a full `pnpm test` run under load and passed alone and in two later full runs. It is unrelated to this story (API only) and looks timing-flaky.
- In the component tests, a refetch through `queryClient.refetchQueries` needs one extra macrotask inside `act` before React sees the data, because TanStack notifies on `setTimeout(0)`. The test helper `refetch()` does this.

**Verification (implementer)**
- `pnpm typecheck`: exit 0.
- `pnpm test`: 21 files, 423 tests pass. That includes the new U4/U5 edit tests (5 cases plus `it.each`), 21 EditForm K3/K6 tests, and the unchanged K1 tests.
- Not run (caller's, under the stack lock): `pnpm test:all`, Playwright (`e2e/edit.spec.ts`, E1, E6, validation), axe coverage, the manual phone/dark check. The e2e spec and the CSS layout (phone/wide, check nudge, swap fade, card buttons) are untested in a real browser.

**Verification (caller, step 3)**
- First `pnpm test:all` under `/tmp/todo-test-stack.lock`: exit 1. Only `e2e/motion.spec.ts` E1 failed, in all three projects. Its MutationObserver found the new card by `li.textContent === text`, which is one more row-text reader the plan's list missed (the "Edit" label). The caller changed that one predicate to compare the text of the span the row's check `aria-labelledby` names. Nothing else in the test changed.
- Second `pnpm test:all`: exit 0, every step passed. E2e passed 84 tests in desktop, phone and desktop-dark, including all 6 `edit.spec.ts` tests per project. Axe coverage passed. todo-test was torn down.
- Manual, on todo-test with a Pixel 7 Chromium in the dark scheme (412 px wide):
  - Keyboard alone: Tab reached Edit. Enter focused the field with the whole text selected. Typing and Enter showed the new text, with focus on the new Edit. The text persisted after a reload. Edit, type, Escape: focus was back on Edit and the text was unchanged.
  - With `docker compose -p todo-test --profile test stop api` after the page loaded: Save reverted the text. The banner read "Couldn't save your edit, so “Manual keyboard todo, edited” is back as it was. The server isn't available right now. Try again in a moment." The next Edit opened with "Draft while api down", and Cancel showed the saved text.
  - The stack was then taken down.

**Review fixes (round 1)**
- `editDescription`'s `failureText` now quotes the todo's text as the cache holds it after the revert. It falls back to the call-time text when the todo is gone, so with two queued edits where the first fails, the message quotes the re-applied later text. New U4 test.
- The card keeps a failed draft only for its latest changed save (a per-card counter), and never on `not-found`. New component test for the superseded case.
- The list deletes the draft-map entry of a vanished edit row. The removed-row focus target is now the number of surviving ids that came before the tracked id, not its raw old index.
- Save gets a `ButtonText` border under forced colours. The Edit-name comment is reworded. `MESSAGES.validation` is removed (unused).
- E2e: the deleted-while-editing test also asserts that the gone row's check and the edit field have count 0.
- New component tests:
  - refetch removal of the last row;
  - window-blur and blur-to-body bookkeeping;
  - the swap-fade class appears only after leaving edit mode;
  - Shift+Enter, composing Enter (`isComposing`, keyCode 229) and the `beforeinput` line break in the edit field.
- Mutation checks: the superseded-draft and blur-to-body tests fail without their fixes.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 28 findings — high 0, medium 0, low 22, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind-hunter) Two edits in flight on one todo: the first failing gives a message quoting the call-time text, while the card shows the later edit, and keeps a superseded draft.
    - Verified: `failureText` used `todo.description`, and `revert()` re-applies later pending edits. `save()` kept the draft without checking whether a later save had started.
    - Fixed: the message quotes the todo's cached text after the revert. A card keeps a draft only from its latest save. Tests added.
  - `[low]` `[reject]` (blind-hunter) The `deletedElsewhere` dedupe matches on text, not on the todo, so it can miss a same-text todo or announce twice after an intervening failure.
    - Real, but it needs two identical texts both deleted elsewhere, or another failure landing between a 404 and its settle-time refetch (milliseconds apart).
    - A per-id record of what the helper announced adds state to the helper, so it is more than a direct correction.
  - `[false]` `[reject]` (blind-hunter) The test edits that break "the add tests run unchanged" are not recorded. Refuted:
    - Plan Tasks list the row-text adaptation.
    - Implementation Notes record the extra `validation.spec.ts` and `motion.spec.ts` reads.
  - `[low]` `[reject]` (blind-hunter) The focus-off-row rule has two implementations, the card's 404 move and the list's refetch move, and the empty-list target is the `<ul>`, not the Empty panel.
    - The duplication is real. Story 5 must teach both to skip Leaving rows; that belongs to the refactor sweep (story 7).
    - The Empty panel does not exist until story 6, which already owns retargeting it (its Notes).
  - `[false]` `[reject]` (blind-hunter) `initial` starts as '' in the card, so a row that becomes editing without `openEdit` opens empty.
    - Refuted: in this story, `editingId` changes only through `open()` (called from `openEdit`), `close()` and the vanish effect.
    - Keys are stable ids, the `<ul>` never remounts, and a row that leaves clears `editingId` in the same commit. No remount with `editingId` set is reachable.
  - `[low]` `[patch]` (blind-hunter) Under forced colours Save has no visible edge (`border: 0`). Fixed: a forced-colours rule gives `.primary` a `ButtonText` border.
  - `[low]` `[patch]` (blind-hunter) Drafts are kept for todos that are gone (a 404 save, a vanished edit row) and never removed. Fixed: no draft is kept on `not-found`, and a vanished edit row's draft is deleted.
  - `[low]` `[patch]` (blind-hunter) No UI test covers a server 400 on edit, and `MESSAGES.validation` is unused.
    - A 400 needs the client and server rules to disagree, which the shared check prevents; U4 covers its message.
    - Fixed: the dead constant is removed.
  - `[low]` `[patch]` (blind-hunter) The edit field's keyboard paths (Shift+Enter, composing Enter, the beforeinput line break) are tested only through the add field. Fixed: EditForm component tests for each.
  - `[low]` `[patch]` (blind-hunter) The edit swap-in motion and "no fade on first load" are untested. Grouped with the verification-gap `swapIn` row; fixed there.
  - `[low]` `[reject]` (blind-hunter) The "todo text through the check's `aria-labelledby`" lookup is copied in four test files. These are test-local helpers in two packages (web, e2e), and no caller depends on them agreeing.
  - `[low]` `[patch]` (blind-hunter) The e2e "deleted elsewhere while editing" assertion `todoItem(...).toHaveCount(0)` passes even while the row is still in edit mode.
    - Fixed: the test also asserts the row's check and the edit field are gone.
    - The synthetic `visibilitychange` is the existing `regainFocus` pattern.
  - `[low]` `[reject]` (blind-hunter) No automated phone-plus-dark project. The ticket assigns that combination to a manual reviewer check, which the caller ran on todo-test (Implementation Notes, Verification (caller)). Adding a fourth project to every spec is beyond a direct correction.
  - `[low]` `[patch]` (edge-case-hunter) A stale draft after a superseded save. Same root cause as the first blind-hunter row; fixed there.
  - `[low]` `[patch]` (edge-case-hunter) The edit failure message names text the card no longer shows when a later edit is pending. Same root cause as the first blind-hunter row; fixed there.
  - `[low]` `[reject]` (edge-case-hunter) "Deleted elsewhere" can be announced twice if another announcement lands before the settle refetch. Same root cause as the blind-hunter dedupe row; rejected there.
  - `[low]` `[patch]` (edge-case-hunter) Two todos with identical text get identical Edit names, despite the comment's uniqueness claim.
    - The behaviour follows EXPERIENCE, which names by the full text.
    - Fixed: the comment now says names are unique whenever the texts differ.
  - `[low]` `[patch]` (edge-case-hunter) The removed-row focus target used the raw old index, so when several rows go together focus can skip the next surviving row. (The "tracked id missing from the previous ids" half cannot happen: focus is only in rendered rows.) Fixed: the index counts surviving ids before the tracked one.
  - `[false]` `[reject]` (edge-case-hunter) The plan's row-text list misses `validation.spec.ts` and `motion.spec.ts`. Its fix would edit the plan, and Implementation Notes already record both.
  - `[low]` `[patch]` (verification-gap) The previous-row fallback when the last row is removed is untested. Fixed: an `it.each` case removes the last row and expects the previous row's check.
  - `[low]` `[patch]` (verification-gap) The blur bookkeeping (window blur keeps the record, focus to nothing clears it) is untested. Fixed: two component tests.
  - `[low]` `[patch]` (verification-gap) Nothing checks that the swap-back fade class appears only after leaving edit mode. Fixed: a component test checks `swapIn` is absent on a fresh card and present after Edit then Cancel.
  - `[low]` `[reject]` (intent-alignment) The add K1, E1 and E6 tests were edited, so "run unchanged" is not met as written.
    - It cannot be met: the required visible "Edit" label joins each row's text.
    - Only row-text reads changed (now the todo's text span or check name). Every add-form assertion, including the field, counter, describedby, paste and IME ones, is unchanged and passes.
  - `[low]` `[patch]` (intent-alignment) The shared field's Enter-229, beforeinput and composition paths are tested only through the add field. Same root cause as the blind-hunter keyboard-paths row; fixed there.
  - `[false]` `[reject]` (intent-alignment) "With the api stopped" is exercised only by `page.route` on the PATCH. Refuted: the caller ran the Verify with `docker compose -p todo-test stop api` on todo-test (Implementation Notes).
  - `[low]` `[patch]` (intent-alignment) The general focus-off-removed-row rule has no test for a focused row that is not in edit mode. Fixed by the blur tests, which remove a row whose check holds focus.
  - `[false]` `[reject]` (intent-alignment) Phone plus dark is not automated. Same as the blind-hunter row: the manual check covers it and was run.
  - `[false]` `[reject]` (intent-alignment) Over-limit and "text changed elsewhere" are only component-tested, and the layout is untested. Refuted as a gap against the intent: the ticket's Verify asks for neither in e2e. Both behaviours have K3 tests, and the phone dark layout was inspected in the manual run's screenshots.

## Design Notes

**Shared text field** (`TextField.tsx`): `useTextField({ hint, initial? })` returns the field's state and the operations below. `TextFieldBox` renders the `.field` box (textarea plus counter footer). `TextFieldNotes` renders, in order, the Inline error (only after an empty submit), the hidden hint span and the always-mounted `role="status"` Field status. The add form keeps its DOM: label, `.row`(box, Add), notes.

| Operation | What it does |
|---|---|
| `value` / `setValue` | Programmatic set, for the add form's clear and restore |
| `ref` | The textarea, for the add form's caret-to-end |
| `submitValue(): string \| null` | Runs `prepareDescription` + `checkDescription`. Valid: returns the prepared text. Empty: shows the Inline error, sets `aria-invalid`, says it again and focuses the field, then returns null. Too long: says the over-limit message again and focuses the field, then returns null. |
| `clearError()` | Clears the empty error and the Field status, for the restore after a failed add |

- The paste and `beforeinput` listeners, the composition rule, the selection restore, the Enter and Shift+Enter handling, the crossing speech and the auto-grow move over **as they are**, including today's #29 and #30 behaviour.
- The empty error clears on the next user input that makes the text valid, as `update()` does today.

**Card markup:** `li` › `.body` › `.card` › `.main`(`.check`, `.content`) + `.actions`(Edit). In edit mode the card is `li` › `.body` › `.card.editing` › `.main`(`.check`, `<EditForm>`).
- Phone: `.card` is a block, and `.actions` is a right-aligned row 8 px below.
- Wide (≥768px): `.card` is a flex row. `.main` has flex 1 and the `--todo-card-check-row-nudge-wide` top padding (none in edit mode, which has no inline buttons), and `.actions` sits inline at the top right.
- `.editing .check { margin-top: var(--completion-check-nudge-edit) }`.
- No `done` class and no chip while editing. The check keeps `checked`.
- Edit uses the soft style, or the done-card variant when completed and not editing. Its name is `Edit “${description}”`, in full, never cut. Save and Cancel sit `--edit-form-gap` below the field or its Inline error, right-aligned.
- Swap fade: under no-preference, the incoming content fades in once from opacity 0 over `--motion-duration-swap`. Going in, that is the textarea, the counter footer and the Save/Cancel row, but never the `.field` box, so its focus ring is visible from the first frame. Coming back, it is `.content` and `.actions`, only on a card that has left edit mode. Nothing fades on first load.

**Card edit flow:**
- **Edit click:** `initial = takeDraft() ?? todo.description` is read in the handler, never during render, because of StrictMode. Then `flushSync(open)`. EditForm's mount layout effect focuses and selects.
- **`onSave(text)`:**
  - Unchanged (`text === todo.description`): `close()`.
  - Changed: `close()`, then `editDescription(todo, text)`. On `failed`, `keepDraft(text)`. On `not-found`, also run the focus move `toggle()` uses, extracted into one function.
- **`close()`:** `flushSync(() => onClose())`, then `editButtonRef.current.focus()`.

**List area** (`TodoList.tsx`):
- **State:** `editingId` and a `useRef(new Map<string, string>())` of drafts. Each card gets `editing`, `open()`, `close()`, `takeDraft()` and `keepDraft(text)`. The closures are stable over the map, so a save settling after its card unmounted still keeps its draft. Opening a row replaces `editingId`, so the old form unmounts silently.
- **Vanished edit row:** each commit, a layout effect records the editing row's `{ id, description, revertedAt }` from `useTodosStore().revertedAt`. When `editingId` is no longer in `todos`, it clears `editingId`. Then, if `revertedAt(id)` is unchanged since the last commit (not a helper revert), it calls `useAnnounceDeletedElsewhere()(description)`. A failed create calls `recordRevert` in the same synchronous step that removes the card, so any render that lacks the row already sees the new `revertedAt`.
- **Focus off a removed row:** `onFocus`/`onBlur` on the `<ul>` track the id of the focused row (a `data-todo-id` on each `li`). The previous commit's ids are kept. In a layout effect, if the tracked row is gone and `document.activeElement` is `<body>` or null, focus goes to the check of the row now at its index, else the one before, else the `<ul>`. This runs before the announce. Story 6 retargets the empty case to the Empty panel.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: every unit, component and integration test passes, including the new U4, U5, K3 and K6 tests and the unchanged K1 tests.
- `pnpm test:all` (caller, holding `/tmp/todo-test-stack.lock`) -- expected: exit 0. E2e passes in desktop, phone and desktop-dark, including `edit.spec.ts` and the unchanged E1 and E6 add specs. Axe coverage passes, and `coverage/scenarios.md` shows K3 and E4 passing.

**Manual checks (caller):**
- On todo-test, a script-driven Chromium at phone width (Pixel 7) in the dark scheme edits a todo by keyboard alone: Tab to Edit, Enter, type, Enter. It checks the new text, then Edit and Escape.
- Then, with `docker compose -p todo-test --profile test stop api`, Save reverts with the banner, and the next Edit opens with the failed draft. Then the stack is taken down.

## Auto Run Result

**Status:** built

**Summary:** A todo card now has an Edit button, named `Edit “{full text}”`. It swaps the row in place for the Edit form: a hidden "Edit description" label, the shared text field and Save/Cancel.
- **Shared text field:** the add field's rules (cleaning, counter, Inline error, Field status, Enter and composition handling, auto-grow) moved unchanged into one `TextField.tsx`, which the add form and the Edit form both use. `AddForm.tsx` went from about 330 to about 80 lines.
- **Save or Enter:** goes through AD-13's helper (`editDescription`, a follow-up `PATCH {description}`). The new text shows at once, unchanged text sends nothing, and focus goes to the row's Edit.
- **Cancel or Escape:** discards the edit.
- **A failed save:** reverts with the `edit` lead plus the reason, flags the card, and keeps the draft for the next Edit only.
- **A 404:** announces "deleted elsewhere" and moves focus to a neighbouring row.
- **List area:** owns which row is editing (one at a time) and the draft map. It announces "deleted elsewhere" when a refetch removes the row in edit mode, but not for a failed create's revert, and not twice. It moves focus off any focused row a refetch removes.
- **Layouts:** phone and wide card layouts, the edit-mode check nudge, card buttons (including a done variant), and the swap fade.

**Files changed:**
- **Shared field:**
  - `apps/web/src/components/TextField.tsx`, `TextField.module.css` (new): the shared text field and its CSS.
  - `apps/web/src/components/AddForm.tsx`, `AddForm.module.css`: use the shared field, with the same DOM.
- **Edit form and card:**
  - `apps/web/src/components/EditForm.tsx`, `EditForm.module.css` (new): the Edit form.
  - `apps/web/src/components/CardButton.module.css` (new): Edit, Save and Cancel styles, including the done-card and forced-colours rules.
  - `apps/web/src/components/TodoCard.tsx`, `TodoCard.module.css`: the Edit button, edit mode, the save flow, kept drafts, layouts and the swap fade.
  - `apps/web/src/components/TodoList.tsx`: editing state, the draft map, the vanished-row announcement, and focus off a removed row.
- **Helper and hooks:**
  - `apps/web/src/todos/mutations.ts`: `editDescription`.
  - `apps/web/src/todos/hooks.ts`: `useEditDescription`, `useAnnounceDeletedElsewhere`.
- **Unit and component tests:**
  - `apps/web/src/todos/mutations.test.ts`: U4 and U5 edit tests.
  - `apps/web/src/components/EditForm.component.test.tsx` (new): K3 and K6.
  - `AddForm.component.test.tsx` `items()`, `Announcer.component.test.tsx` and the `TodoCard.component.test.tsx` K6 tab order: row-text reads and tab order adapted to the Edit button.
- **E2e:**
  - `e2e/edit.spec.ts` (new): E4, E6, E7 and E8 for edit.
  - `e2e/helpers.ts`: `editButton`, `editField`, `MESSAGES.editFailed`.
  - `e2e/todos.spec.ts`, `validation.spec.ts`, `motion.spec.ts`: row-text reads now use the todo's text span or check name.

**Review:** thorough (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 28 findings: high 0, medium 0, low 22, false 6.
- **Patched:** 16 rows in 11 entries, all low.
  - Two queued edits: the message quotes the text shown after the revert, and only the latest save keeps a draft.
  - No draft on not-found, and a vanished row's draft is deleted.
  - The focus target counts surviving rows.
  - A forced-colours border on Save.
  - The Edit-name comment.
  - The unused `MESSAGES.validation` is removed.
  - A stronger e2e vanished-row assertion.
  - Tests for the last-row focus fallback, the blur bookkeeping, the swap fade class, and the edit field's Shift+Enter, composing-Enter and beforeinput paths.
- **Deferred:** none.
- **Rejected:** each with its reason in the Review Triage Log.
  - The text-only dedupe of "deleted elsewhere".
  - Two focus-move implementations (left for the refactor sweep). The Empty panel target belongs to story 6.
  - Copied test lookups.
  - No phone+dark project (covered by the manual check).
  - Add tests not literally unchanged (impossible with the visible Edit label; only row-text reads changed).
  - 6 false findings.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 11 entries.

**Verification:**
- `pnpm typecheck`: exit 0.
- `pnpm test`: 21 files, 433 tests passed (after the review patches).
- `pnpm test:all` under `/tmp/todo-test-stack.lock`, three runs:
  - The first failed only on `motion.spec.ts`'s row-text lookup, which the caller fixed.
  - The second and third (the third after the review patches) exited 0, with every step passed.
  - E2e passed 84 tests in desktop, phone and desktop-dark, and axe coverage passed.
  - `coverage/scenarios.md` shows K3 (28), E4 (6), U5, K6, E6, E7, E8, and K1 and E1 passing.
- **Manual on todo-test (Pixel 7, dark):**
  - A keyboard-only edit: Tab to Edit, Enter selected all, the typed text and Enter showed the new text with focus on Edit, and it persisted after a reload. Escape changed nothing.
  - With the api stopped, Save reverted with the banner, and the next Edit opened with the failed draft.
  - The stack was taken down after each run.

**Residual risks:**
- Production Verify runs only after merge and deploy.
- The rejected edge cases above.
- No automated test fails without the multi-row focus fix.
- The swap fade and the wide layout were seen in a real browser only through the e2e axe runs and the phone screenshots.
