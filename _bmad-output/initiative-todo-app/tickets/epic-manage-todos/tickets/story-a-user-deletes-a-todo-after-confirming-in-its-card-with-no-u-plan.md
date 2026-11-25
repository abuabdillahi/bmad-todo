---
title: 'A user deletes a todo after confirming in its card, with no undo'
type: feature
ticket: '5'
created: '2026-11-25'
status: built
baseline_revision: '1df561367a3f54372b06e339a0325690087d7d8f'
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

**Problem:** A todo can't be deleted from the UI (R5). The card has no Delete button, the client has no `deleteTodo`, and `request()` reads `response.json()` on every success, so DELETE's bodyless `204` would fail as `generic`.

**Approach:** The card gets a Delete button that opens an inline Delete confirm ("Delete this todo?", Confirm delete, Cancel) in place of Edit and Delete, sending nothing. Confirm delete moves focus by the after-delete rule, turns the row into an inert, aria-hidden Leaving copy that the list area keeps for its exit motion only (AD-11), and deletes through AD-13's helper (`DELETE /api/todos/{id}`, 404 = success, "Deleted “{t}”." on server confirmation). A failed delete restores the row in place, fresh, flagged, with the `delete` lead plus reason. The list area owns one open row, in edit mode or confirm, never both.

## Boundaries & Constraints

**Always:**
- Components change todos only through hooks in `apps/web/src/todos/` (AD-11), and delete only through the one helper (AD-13). Every message comes from `messages.ts` (`lead.delete`, `deleted`) through `failureMessage`/`quote()`.
- `deleteTodo` sends no body and no `Content-Type`; `send()` resolves a `204` (or any 2xx with no body) without reading JSON. The write timeout applies to DELETE like every write.
- Hand-off order (EXPERIENCE Interaction Primitives): focus reaches its target in the same task, before the focused element is removed or made inert (`flushSync` where the target must render first); `document.activeElement` is never `<body>` in between.
- Focus targets skip Leaving rows: the after-delete rule, the card's not-found `moveFocusOffRow`, and the list's refetch-removal move.
- Styling only from `tokens.css` tokens; motion only under `prefers-reduced-motion: no-preference`; the leave timer is 0 under reduced motion and never waits for `animationend`.
- Test titles lead with scenario ids (K4, E3, U5, K6, E6, E7, E8). Every e2e test keeps an axe scan.
- Implementer shell: put node 26.13.1 (`$HOME/.nvm/versions/node/v26.13.1/bin`) on `PATH` and run only `pnpm typecheck` and `pnpm test`. `pnpm test:all`, Playwright and docker are the caller's, under the shared todo-test stack lock.

**Never:**
- No undo, modal, toast, saving indicator or new live region; no new `FailureKind` or problem type.
- No change to the API, `packages/contract`, `openapi.json`, nginx, compose or CI.
- Do not touch `apps/web/src/components/TextField.tsx` or `TextField.module.css` (bug #30 is being fixed there in parallel).
- No Empty, loading or error panel and no empty-list retarget to an Empty panel (story 6); no merge of the two focus-off-row copies (story 7).
- No test-only switch in app code; e2e failure injection only by `page.route` (and the caller's `stop api`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open confirm | Delete pressed | Edit and Delete swap in place for "Delete this todo?", Confirm delete, Cancel. Focus to Cancel in the same task. Nothing sent. Check stays operable and doesn't close it. | none |
| Cancel | Cancel, or Escape with focus anywhere in the confirm group | Closes, focus to that row's Delete, nothing sent | none |
| Confirm delete | Confirm delete pressed | Focus first moves to the next non-leaving row's check, else the previous one's, else the add field (keyboard/mouse) or the heading (last `pointerdown` was touch/pen). Then the row turns Leaving (inert, aria-hidden), plays the leave motion and unmounts after `--motion-duration-base` (0 under reduced motion). `DELETE` sent. | none |
| Delete succeeds | 204 or 404 | "Deleted “{t}”." in the status variant on server confirmation, not on press. Gone after refresh. | 404 is success, never reverted |
| Delete fails | 503, 500, non-problem error, no response (15 s timeout) | The Leaving copy unmounts at once; the todo is back at its old index, mounted fresh, with the Add motion and the revert flag, fully operable. Focus not moved. | `Couldn't delete “{t}”, so it's back in the list.` plus reason |
| Behind a pending create | Card added, POST unanswered, deleted | Row leaves at once; DELETE sent after the POST settles. Create fails: delete dropped (not sent, announced or reverted), only the add failure announced. | as left |
| One open row | Edit or Delete on another row while an edit or confirm is open | The open one closes silently; focus to the new row's field (edit) or Cancel (confirm) | none |
| Confirm open, todo vanishes | Refetch removes a row whose confirm is open | Row unmounts at once, no message; focus (if in the row) moves by the list's rule; open state cleared | none |

</intent-contract>

## Code Map

- `apps/web/src/api/client.ts` -- `send()` (l.90) always reads JSON; `request()` (l.117) adds the write timeout to non-GET; `updateTodo` is the model for `deleteTodo`. `RequestFailure.kind` `'not-found'`.
- `apps/web/src/todos/mutations.ts` -- `MutationHelper`, `run()`, `setCompleted`, `editDescription`. `apply` returning null removes the todo; `revert()` writes the base back at `entry.index`, then `recordRevert(id)` and `announce` in the same synchronous `settle` step. Don't change `run`, `execute`, `revert`, `settle`.
- `apps/web/src/todos/hooks.ts` -- add `useDeleteTodo()` beside `useEditDescription`. `useRevertedAt`, `useTodosStore` exist.
- `apps/web/src/todos/messages.ts` -- `lead.delete`, `deleted(t)`, `failureMessage('delete', failure, t)` exist. Read only.
- `apps/web/src/components/TodoCard.tsx` -- `CardEditing` props from the list, `openEdit`/`closeEdit` (flushSync then focus), `moveFocusOffRow` (l.104, uses raw siblings: teach it to skip Leaving rows), `.actions` holding Edit, `swapBack`/`leftEdit` fade pattern, `useRevertFlag`. Keep `li` › `.body` › `.card` (tests walk it).
- `apps/web/src/components/TodoCard.module.css` -- `.enter` open motion and `todo-card-open`/`todo-card-clip`/`todo-card-in` keyframes (mirror them for leave), `.actions` phone/wide layout, `.swapIn`, `.flagged`, `.enter .flagged`.
- `apps/web/src/components/CardButton.module.css` -- add `.danger` (Delete: `--delete-button-*`), `.dangerStrong` (Confirm delete: `--confirm-delete-button-*`, border 0, forced-colours `ButtonText` border like `.primary`). Delete on a done card uses the existing `.done`; Confirm delete and Cancel keep full style on a done card.
- `apps/web/src/components/TodoList.tsx` -- `editingId` state + `editingFor()`, `focusedId` tracking, the refetch focus-move layout effect (l.84; its target lookup must skip Leaving rows), the vanished-edit-row effect (l.109). `enter` computation.
- `apps/web/src/components/Announcer.tsx` -- `leaveDuration()` (matchMedia reduced-motion pattern) and the touch/pen `lastPointerType` pattern to copy. `App.tsx` gives the Announcer `headingRef`/`addFieldRef`; the add field is the textarea named "New todo", the heading is the `h1` with `tabIndex={-1}`.
- `apps/web/src/styles/tokens.css` -- `--delete-confirm-foreground[-done]`, `--delete-confirm-gap`, `--delete-button-*`, `--confirm-delete-button-*`, `--motion-duration-base` (200ms), `--motion-duration-swap`, `--motion-ease-out`. No new tokens needed.
- Tests to extend/copy: `apps/web/src/api/client.test.ts` (K7/U4 patterns, fetch stubs); `todos/mutations.test.ts` (`setup`, `held`, `flush`, `problem`, the U5 edit/complete cases); `components/TodoCard.component.test.tsx` (`serve` with gated PATCH, `gate`, `liveElement`, `renderLoaded`; its K6 tab-order test expects check → Edit → next check, now check → Edit → Delete → next check); `components/EditForm.component.test.tsx` (`refetch()` helper; any tab-order or "second Edit" test).
- `e2e/helpers.ts` -- add `deleteButton(page, t)` (exact `Delete “{t}”`, the row button; also matches Confirm delete, so scope by group), `deleteConfirm(page, t)` (`role=group` named `Delete this todo? {t}`), `MESSAGES.deleted(t)`, `MESSAGES.deleteFailed(t, reason)`. `e2e/complete.spec.ts` deleted-elsewhere test tabs at most 4 times: with Delete between checks it needs up to 5 -- raise the bound. `e2e/edit.spec.ts` `tabToOnlyEdit` (field, Add, check, Edit) is unaffected.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/api/client.ts` -- `send()`: on `204` (or a 2xx whose body is empty) resolve `undefined` without `json()`. Add `deleteTodo(id): Promise<void>`: `request<void>(path, { method: 'DELETE' })`, no headers beyond `Accept`, no body -- AD-6, ticket Notes.
- [x] `apps/web/src/api/client.test.ts` -- DELETE 204 resolves undefined; the request has method DELETE, no body and no `Content-Type`; 404 problem rejects `not-found`; a DELETE with no response for 15 s rejects `network` (fake timers, like the create case).
- [x] `apps/web/src/todos/mutations.ts`, `hooks.ts` -- `deleteTodo(todo: Pick<Todo,'id'|'description'>)`: `run({ id, kind: 'follow-up', apply: () => null, send: () => deleteTodo(id).catch(e => { if (e instanceof RequestFailure && e.kind === 'not-found') return; throw e; }), failureText: f => messages.failureMessage('delete', f, todo.description), successText: messages.deleted(todo.description) })`. Hook `useDeleteTodo()` -- AD-13.
- [x] `apps/web/src/todos/mutations.test.ts` -- U4/U5 delete: removes at once and sends DELETE; 204 announces `deleted` (status) only after the server answers; 404 is success (announces `deleted`, no revert, no `recordRevert`); a 503 puts the todo back at its old index, records the revert and announces lead + reason; behind a pending create it is sent after the POST; the create failing drops it (not sent, nothing announced for it, promise `dropped`, pending count back to 0).
- [x] `apps/web/src/components/CardButton.module.css` -- `.danger`, `.dangerStrong` with hover (under `(hover: hover)`), pressed, forced-colours edge for `.dangerStrong` -- DESIGN.md Card buttons.
- [x] `apps/web/src/components/TodoCard.tsx`, `TodoCard.module.css` -- Delete button after Edit in `.actions` (`.danger`, or `.done` on a done card), named `Delete “{full text}”`. Confirm mode renders, in `.actions` (swap-fade like edit), a `role="group"` `aria-labelledby="{promptId} {textId}"` with the prompt span "Delete this todo?" (colour `--delete-confirm-foreground`, `-done` on a done card), Confirm delete (visible "Delete", name `Delete “{full text}”`, `.dangerStrong`) then Cancel (`.cancel`), gap `--delete-confirm-gap`, right-aligned, centred, wrapping; group `onKeyDown` Escape (not composing) cancels. Handlers per Design Notes. A `leaving` prop renders the row `inert`, `aria-hidden="true"`, `data-leaving`, with the leave class and no enter motion. `moveFocusOffRow` skips `[data-leaving]` siblings. Leave CSS: row height `1fr → 0fr` and card opacity `1 → 0` over `--motion-duration-base` `--motion-ease-out`, `forwards`, clip while closing, none under reduced motion -- R5, AD-11, EXPERIENCE Motion.
- [x] `apps/web/src/components/TodoList.tsx` -- replace `editingId` with one open row `{ id, mode: 'edit' | 'confirm' } | null`; keep the edit behaviour and its vanish announce exactly; a vanished confirm row clears silently. Own the Leaving rows (Design Notes). Exclude Leaving rows from the refetch focus target. Pass each card `edit`, `confirm` and `leaving` -- AD-11, EXPERIENCE Todo card.
- [x] `apps/web/src/components/TodoList.tsx` or a small sibling module -- the pure merge function (Design Notes), exported for a unit test.
- [x] `apps/web/src/components/DeleteConfirm.component.test.tsx` (new; `renderApp` + MSW like `TodoCard.component.test.tsx`, with a gated DELETE) -- one test or more per I/O Matrix row: K4 open sends nothing and focuses Cancel; Cancel and Escape close with nothing sent and focus Delete; Confirm delete removes the row from the accessible tree at once (before the server answers) and focus is on the next check, else previous, else the add field, and the heading after a `pointerdown` with `pointerType: 'touch'`; `Deleted “{t}”.` only after the gated DELETE answers; 404 announces `Deleted`; 503 restores the row at its index, flagged, operable, with the message, focus unmoved; one open row (confirm closes an edit and vice versa); confirm-open row vanishing on refetch is silent; the check toggles with the confirm open and it stays open. K6: names of Delete, the group, Confirm delete, Cancel; tab order check → Edit → Delete → next check, and in confirm check → Confirm delete → Cancel; after each of Delete, Cancel, Escape and Confirm delete, with nothing awaited, `document.activeElement` is the target. Leaving: the leaving row is inert and aria-hidden, unmounts once the timer runs (fake timers or `matchMedia` stub), and a 404 focus move / refetch move skips it.
- [x] Existing tests: `TodoCard.component.test.tsx` K6 tab order (Delete between Edit and next check); any `EditForm.component.test.tsx` tab-order expectation likewise. No other assertion changes.
- [x] `e2e/helpers.ts`, `e2e/complete.spec.ts` -- helpers above; raise the deleted-elsewhere Tab bound to 5.
- [x] `e2e/delete.spec.ts` (new, `beforeEach` `resetList`; todos set up through the API) -- (a) `E3 E7 E8` keyboard: Tab to Delete, Enter: the confirm shows "Delete this todo?", focus on Cancel, no DELETE sent (a `page.on('request')` counter); Enter on Cancel closes, focus on Delete; Delete again, Escape closes, the todo stays; Delete, Shift+Tab to Confirm delete, Enter: the row is gone at once, focus on the other todo's check, `Deleted “{t}”.` shows, and it stays gone after a reload. Axe in confirm state and after delete. (b) `E3 E7` pointer: click/tap Delete then Confirm delete; gone after reload. (c) `E6 E8` × {503 `UNAVAILABLE_BODY`, `route.abort()`} on DELETE: the row comes back, the banner shows `deleteFailed`, the todo is still listed after `unroute` + reload. Axe.

**Acceptance Criteria:**
- Given the test profile with a todo, when a user presses its Delete, then "Delete this todo?" shows and no request is sent; Cancel and Escape each close it and the todo stays; Confirm delete removes it at once, "Deleted “{t}”." shows, and it is still gone after a reload, in desktop, phone and desktop-dark.
- Given the api is stopped on todo-test after the page loaded, when a user confirms a delete, then the todo comes back flagged with the banner `Couldn't delete “{t}”, so it's back in the list.` plus the unavailable reason.
- Given `pnpm test:all` (caller, under the stack lock), when it finishes, then it exits 0, axe coverage passes, and `coverage/scenarios.md` lists passing K4 and E3 tests.

## Implementation Notes

- `request()`/`send()` take a `readBody` option; only `deleteTodo` passes `readBody: false`, so any 2xx on DELETE resolves `undefined` without reading a body. Every other request still reads JSON, so an empty 2xx on them stays `generic`.
- `isLive` ends an entry on a changed `revertedAt` only when the id is back in the cache: a failed call queued before the delete, whose revert re-applies the delete, keeps the Leaving copy.
- The merge lives in `apps/web/src/components/leaving-rows.ts` (`mergeRows`, `isLive`, `withoutLeft`), unit-tested in `leaving-rows.test.ts`. An entry's `index` is its place among the rendered rows at confirm (not the cache index), so rows deleted in quick succession land where each showed; when a Leaving copy's timer unmounts it, `withoutLeft` moves later entries up one place. `isLive` also ends an entry whose delete settled with the todo in the cache, so `mergeRows` never renders a stale Leaving copy for a commit.
- The Delete confirm's group holds the prompt and a span wrapping Confirm delete and Cancel, so a wrap puts the prompt on its own line and never splits the buttons. On wide, the confirm's `.actions` may shrink (`flex: 0 1 auto`) so it wraps instead of pushing the text.
- `.actions` is keyed (`buttons` / `confirm`) so each swap remounts it and only incoming content fades; the text view still fades only after edit (`leftEdit`), Edit/Delete fade after edit or confirm (`leftSwap`).
- `DeleteConfirm.component.test.tsx` holds leave timers by spying `setTimeout` for `LEAVE_MS` calls (test-side only), so Leaving-row assertions are deterministic. Tests that confirm a delete wait for its answer, so no in-flight DELETE reaches the next test's MSW handlers.
- Known cosmetic: when the last row is deleted, the card above keeps its bottom gap until the Leaving copy unmounts (200 ms), then the gap snaps shut.
- The caller ran `pnpm install --frozen-lockfile --prefer-offline` in the fresh worktree (no lockfile change).

**Verification (caller, step 3 and after review patches)**
- `pnpm typecheck`: exit 0. `pnpm test`: 23 files, 480 tests before review, 484 after the review patches, all passing.
- `pnpm test:all` under `/tmp/todo-test-stack.lock`, twice (before and after the review patches): exit 0 both times, every step passed (e2e in desktop, phone and desktop-dark including `delete.spec.ts`, axe coverage, contract, profile, contract-unavailable). `coverage/scenarios.md`: U5, K4 (18), K6, E3 (6), E6, E7, E8 pass. todo-test was torn down each time.
- Manual, on todo-test with a Pixel 7 Chromium in the dark scheme: keyboard Tab to `Delete “Manual goes”`, Enter: focus on Cancel, the prompt visible, 0 DELETEs. Escape: focus back on Delete, 0 DELETEs. Enter, Shift+Tab, Enter on Confirm delete: focus on the "Manual keep" check, one row left, "Deleted “Manual goes”." in the status, 1 DELETE; still gone after reload. Then `docker compose -p todo-test --profile test stop api` and a tapped Delete, Confirm delete on the only row: the row came back with the `flagged` class (solid outline in the screenshot), the banner read "Couldn't delete “Manual keep”, so it's back in the list. The server isn't available right now. Try again in a moment.", and focus was on the heading (tap, last row). The stack was then taken down.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 33 findings — high 0, medium 5, low 23, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) The bodyless-success return sat in the shared `send()`, so an empty 2xx on list, create or update resolved `undefined`. — Verified: `listTodos` → `createTodosQueryFn` would record fetch success with no data. Fixed: a `readBody` option only `deleteTodo` sets to false; new K7 test that an empty 200 on `listTodos` stays `generic`.
  - `[low]` `[patch]` (blind-hunter) The 204 and Content-Length clauses were never tested on their own (both tests used a null body). — Same root cause as the row above; the clauses are gone, DELETE now never reads a body, and its tests cover a 204 and a 2xx with a body.
  - `[low]` `[reject]` (blind-hunter) A gone Leaving copy is placed by its confirm-time index, which goes stale if rows are added or reordered above it during the 200 ms leave. — Real but cosmetic for at most 200 ms (0 under reduced motion); anchoring to a neighbour id adds state beyond a direct correction.
  - `[low]` `[patch]` (blind-hunter) Deleting while an earlier save on the same todo is pending: if that save fails, the Leaving copy vanished with no motion (and the helper announces that save's failure). — Verified via `revert()` re-applying the queued delete and `recordRevert`. Fixed: `isLive` treats a changed `revertedAt` as a failed delete only when the id is back in the cache; unit test added. The queued save's own failure message is the helper's existing per-call behaviour (AD-13), unchanged.
  - `[low]` `[reject]` (blind-hunter) The add field and heading are found by DOM lookups (label text, `main h1`). — The plan allowed a DOM query; renaming them is a developer change that tests catch (K6 add-field and heading focus tests); plumbing refs through context is more than a direct correction.
  - `[low]` `[reject]` (blind-hunter) `LEAVE_MS = 200` mirrors `--motion-duration-base` by hand. — Same accepted pattern as `REVERT_FLAG_MS`; the token is not expected to change in this epic.
  - `[false]` `[reject]` (blind-hunter) Escape does not close the confirm with focus on the row's check. — EXPERIENCE scopes Escape to "focus anywhere in the group"; the check is outside the Delete confirm group by design and stays operable without closing it.
  - `[low]` `[patch]` (blind-hunter) The done-card button test compared against an unrelated class and always passed; no test checked Delete's `.done`/`.danger`. — Fixed: asserts `.dangerStrong` not `.done` on Confirm delete, `.cancel` on Cancel, `.danger` on an open card's Delete and `.done` on a done card's.
  - `[low]` `[patch]` (blind-hunter) The last assertion of "Confirm delete skips a Leaving row" was always true. — Fixed: compares the rows' texts in order.
  - `[low]` `[patch]` (blind-hunter) The reduced-motion test deleted `window.matchMedia` instead of restoring it; `holdLeaveTimers` holds any 200 ms timer. — Fixed the first: the original descriptor is restored. The second is test-only and no other 200 ms timer exists in the app.
  - `[false]` `[reject]` (blind-hunter) A deleted todo's failed edit draft is never cleared. — No bad outcome: if the delete fails the draft must survive for the next Edit (WCAG 3.3.7), and after a successful delete the id never renders again, so the entry is unreachable.
  - `[low]` `[patch]` (blind-hunter) The e2e tests don't prove removal before the answer, the tapped-last-row focus, 404, reduced motion, or the flag and focus after a failed delete. — Fixed the last two: the failure tests now assert the restored card's `_flagged_` class and that focus stays on the add field. The rest are covered by component and unit tests (gated DELETE, synthetic touch, 404) and were seen in the caller's manual run (tap → heading).
  - `[medium]` `[patch]` (verification-gap) The shared `send` change affected list, create and update with no test. — Pre-verified; same root cause as the first row; fixed there with the K7 empty-200 test.
  - `[low]` `[patch]` (verification-gap) Nothing tested the swap fade after the Delete confirm. — Fixed: new test (no `swapIn` on first load; after Delete then Cancel the actions fade in and the text does not).
  - `[medium]` `[patch]` (verification-gap, other) An empty 2xx on `GET /api/todos` reaches `recordFetchSuccess` with no data. — Same root cause as the first row; fixed there.
  - `[medium]` `[patch]` (edge-case-hunter) Any method answering 204 or an empty 2xx resolves `undefined`. — Same root cause as the first row; fixed there.
  - `[low]` `[patch]` (edge-case-hunter) A queued PATCH failing after the delete applied makes the Leaving copy vanish. — Same root cause as the blind-hunter queued-save row; fixed there.
  - `[low]` `[patch]` (edge-case-hunter) A dead entry dropped while absent from the cache doesn't shift later indices. — Same root cause: after the `isLive` fix an entry is only ever dead while its id is in the cache, so this path no longer occurs.
  - `[low]` `[reject]` (edge-case-hunter) A gone entry's raw index goes stale when rows change above it. — Same as the blind-hunter index row; rejected there.
  - `[low]` `[reject]` (edge-case-hunter) Deleting the last row leaves the previous card's gap until unmount, then it snaps. — Cosmetic, 200 ms, motion-on only; a `:has()` transition rule is more than a direct correction. Recorded in Implementation Notes.
  - `[low]` `[reject]` (edge-case-hunter) `LEAVE_MS` hard-codes the token. — Same as the blind-hunter row; rejected there.
  - `[low]` `[patch]` (edge-case-hunter, claim) An empty chunked 2xx without Content-Length still called `json()`. — Same root cause as the first row; DELETE now never reads a body.
  - `[false]` `[reject]` (intent-alignment) "With the api stopped" is exercised only by `page.route`. — The caller ran the Verify with `docker compose -p todo-test stop api` on todo-test (Implementation Notes), and AD-20 makes `page.route` the e2e injection; `pnpm test:all`'s contract-unavailable step also runs with the api stopped.
  - `[low]` `[patch]` (intent-alignment) "Comes back flagged" was asserted only in jsdom. — Same root cause as the blind-hunter e2e row; the e2e failure tests now assert the flag.
  - `[low]` `[patch]` (intent-alignment) E8 for E6's delete part: the failure tests drove by click/tap, not keyboard. — Fixed: both failure tests are keyboard-only (Tab, Enter, Shift+Tab, Enter).
  - `[low]` `[reject]` (intent-alignment) "Removes it at once" isn't proven in e2e. — Proven at component level with a gated DELETE; the e2e auto-wait can't distinguish without holding the route, which the component test already does.
  - `[low]` `[reject]` (intent-alignment) 404-is-success has no e2e. — Covered by U5 unit and K4 component tests; a real 404 in e2e needs a race with a second client.
  - `[low]` `[patch]` (intent-alignment) No UI test of a confirm on a card whose create then fails. — Fixed: new component test (card unmounts at once, only the add failure announced, no DELETE, open state cleared). The queued-behind-create delete is covered by U5.
  - `[false]` `[reject]` (intent-alignment) One open row and the vanished confirm are tested only at component level. — That is K4/K6's layer in the test strategy; nothing in the intent asks for them in e2e.
  - `[low]` `[patch]` (intent-alignment) Focus after Confirm delete is only partly asserted in e2e. — Fixed with the failure tests' add-field focus assertions; the tap-to-heading path is component-tested and was seen in the manual run.
  - `[low]` `[reject]` (intent-alignment) The leave motion is never played in a real browser (every project reduces motion; `motion.spec.ts` not extended). — The ticket's Verify doesn't ask for it; component tests check the class and timer. Extending the motion spec is more than a direct correction.
  - `[medium]` `[patch]` (intent-alignment) The `client.ts` change reaches beyond the Note to every request. — Same root cause as the first row; fixed there.
  - `[false]` `[reject]` (intent-alignment) Edits outside the stated surface (Tab bounds, tab-order tests). — These are the required consequence of the new Delete tab stop, and the plan lists them.

## Design Notes

**Card handlers** (`confirm: CardConfirm` from the list: `{ confirming, open(), close(), remove() }`):
- Delete click: `flushSync(confirm.open)`, then `cancelRef.current.focus()`.
- Cancel / Escape: `flushSync(confirm.close)`, then `deleteRef.current.focus()`.
- Confirm delete click: pick the target (next `li` sibling not `[data-leaving]` → its check; else previous; else add field, or the heading when the last `pointerdown` on the card was `touch`/`pen` and the click's `detail !== 0`), focus it (`preventScroll` for the heading), then `flushSync(confirm.remove)`. Find the add field and heading by DOM (`textarea` named by the "New todo" label / `main h1`) or pass App's refs through context; don't add props through App if a DOM query suffices.

**Leaving rows (list area):** `remove()` records `{ todo, index, revertedAt: store revertedAt(id) }` in a `leaving` map state, clears the open row, and calls `useDeleteTodo()(todo)`. Render through a pure `mergeRows(todos, leaving, revertedAt)`:
- an entry whose `revertedAt(id)` changed since confirm is dropped: the restored todo renders normally;
- a todo in the cache with a live entry renders as its Leaving copy in place;
- an entry whose id left the cache is inserted at `min(index, length)`;
- Leaving copies use key `leaving:${id}`, normal rows `id`, so the confirmed row remounts as its Leaving copy and a restored row mounts fresh (with `enter`, so it plays the Add motion beside the flag).
Effects: when an entry's id is absent from the cache, start its timer (`LEAVE_MS` 200, mirroring `--motion-duration-base`, 0 under reduced motion via `matchMedia`) to drop it; drop entries whose `revertedAt` changed; when the delete's promise settles with the id still in the cache and not reverted (dropped, or a refetch brought it back), drop the entry. Clear timers on unmount. The focus-move effect's target ids exclude leaving ids.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: all unit, component and integration tests pass, including the new client, U4/U5 delete, K4 and K6 tests.
- `pnpm test:all` (caller, holding `/tmp/todo-test-stack.lock`) -- expected: exit 0; e2e passes in desktop, phone and desktop-dark including `delete.spec.ts`; axe coverage passes; `coverage/scenarios.md` lists K4 and E3.

**Manual checks (caller):**
- On todo-test, a script-driven Chromium (Pixel 7, dark): Delete, Cancel, Escape, Confirm delete by keyboard; the row goes and focus lands on the next check. Then with `docker compose -p todo-test --profile test stop api`, Confirm delete brings the row back flagged with the banner. Then take the stack down.

## Auto Run Result

**Status:** built

**Summary:** A todo card now has a Delete button, named `Delete “{full text}”`, after Edit. It opens the inline Delete confirm in place of Edit and Delete: "Delete this todo?", Confirm delete (visible "Delete") and Cancel, in a `role="group"` named by the prompt and the todo text. Nothing is sent until Confirm delete.
- **Cancel or Escape:** closes the confirm, focus back on Delete.
- **Confirm delete:** focus moves first (next operable check, else previous, else the add field, or the heading after a tap), then the row becomes an inert, `aria-hidden` Leaving copy that collapses over `--motion-duration-base` (0 under reduced motion) and unmounts. The delete goes through AD-13's helper as a follow-up `DELETE`, so behind a pending create it waits and is dropped if the create fails.
- **204 or 404:** "Deleted “{t}”." on server confirmation.
- **Failure:** the todo is back at its place, mounted fresh with the Add motion and the revert flag, with `Couldn't delete “{t}”, so it's back in the list.` plus the reason; focus is not moved.
- **One open row:** the list owns one row in edit mode or confirm; opening another closes it silently; a confirm whose todo vanishes closes silently.
- **Client:** `deleteTodo` sends no body and no `Content-Type`, and never reads the response body; every other request is unchanged.

**Files changed:**
- `apps/web/src/api/client.ts`: `readBody` option, `deleteTodo`. Tests in `client.test.ts`.
- `apps/web/src/todos/mutations.ts`, `hooks.ts`: helper `deleteTodo` (404 = success), `useDeleteTodo`. U4/U5 tests in `mutations.test.ts`.
- `apps/web/src/components/CardButton.module.css`: `.danger`, `.dangerStrong`.
- `apps/web/src/components/TodoCard.tsx`, `TodoCard.module.css`: Delete button, Delete confirm, focus hand-offs, Leaving copy and leave motion, not-found focus move skipping Leaving rows.
- `apps/web/src/components/TodoList.tsx`: one open row, Leaving rows with their timers, refetch focus move skipping Leaving rows, silent close of a vanished confirm.
- `apps/web/src/components/leaving-rows.ts` (new) and `leaving-rows.test.ts` (new): the pure row merge.
- `apps/web/src/components/DeleteConfirm.component.test.tsx` (new): K4 and K6.
- `TodoCard.component.test.tsx`, `EditForm.component.test.tsx`: tab order with Delete.
- `e2e/delete.spec.ts` (new): E3, E6, E7, E8. `e2e/helpers.ts`: `deleteButton`, `deleteConfirm`, `MESSAGES.deleted`, `MESSAGES.deleteFailed`. `e2e/complete.spec.ts`: Tab bound 4 → 5.

**Review:** thorough (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 33 findings: high 0, medium 5, low 23, false 5.
- **Patched (8 entries: medium 1, low 7):** the shared-`send` bodyless return (DELETE-only `readBody: false`, K7 empty-200 test); the Leaving copy vanishing after an earlier queued save's revert (`isLive`); the done-card button-class test; an always-true assertion; the `matchMedia` restore; the swap-fade-after-confirm test; the failed-add-with-confirm-open test; the e2e failure tests made keyboard-only with flag and focus assertions.
- **Deferred:** none.
- **Rejected:** stale leave index for 200 ms; DOM lookups for the add field and heading; `LEAVE_MS` mirror of the token; last-row gap snap; e2e for "at once", 404 and motion (covered at unit/component level); and 5 false findings (Escape on the check, deleted-todo drafts, api-stopped via `page.route`, component-level one-open tests, Tab-bound edits). Reasons in the Review Triage Log.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 1, low 7.

**Verification:**
- `pnpm typecheck`: exit 0. `pnpm test`: 484 tests pass after the patches.
- `pnpm test:all` under the stack lock, twice (before and after the review patches): exit 0, every step passed; `coverage/scenarios.md` lists U5, K4, K6, E3, E6, E7 and E8 passing.
- Manual on todo-test (Pixel 7, dark): keyboard Delete, Escape and Confirm delete, then a tapped delete with the api stopped came back flagged with the banner (Implementation Notes).

**Residual risks:**
- Production Verify runs only after merge and deploy.
- The leave motion was never seen in an automated real-browser run with motion on, and the last-row gap snaps at the end of the leave.
- The rejected edge cases above.
