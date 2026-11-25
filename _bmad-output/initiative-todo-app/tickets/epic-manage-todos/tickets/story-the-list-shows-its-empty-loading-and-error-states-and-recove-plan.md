---
title: 'The list shows its empty, loading and error states, and recovers from a failed load'
type: feature
ticket: '6'
created: '2026-11-25'
status: built
baseline_revision: '562e2a2d2ef25960b56946fe126846a2478777b3'
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
deferred: []
---

<intent-contract>

## Intent

**Problem:** The list area renders only the Todo list `<ul>`, whatever the list state (AD-11's selector, `useListState`, already returns `loading | error | populated | empty`). A first load that is slow, fails or recovers shows nothing, says nothing, and has no Try again; an empty list shows a bare empty `<ul>`; and a row removed by not-found or a refetch as the last row sends focus to the `<ul>`, not the Empty panel (2.3 review, ticket Notes).

**Approach:** `TodoList` renders AD-11's list states from the selector: the Todo list `<ul>` whenever it has rows (live or Leaving), the skeleton list (3 Skeleton cards) while loading, the List error panel (load line + Try again) on error, the Empty panel when loaded with no rows. It owns the one Loading status (always mounted, visually hidden), with AD-14's entry / 500 ms / 5 s / recovery-line rules, and extends its focus tracking from rows to the list, the Empty panel and the List error panel, so every removal of the focused element lands on EXPERIENCE's target.

## Boundaries & Constraints

**Always:**
- List state only from `useListState()` / `selectListState` (AD-11); the panel's reason only from the store's `lastFetchFailure` via `messages.loadError(kind)`; Try again only through `useRetryFetch()` (it already gates on the pending count, AD-13). Every string from `messages.ts` (add `loading: 'Loading your todos'` and `loaded: 'Your todos are loaded.'`, plus `emptyList: 'No todos yet.'` and `tryAgain: 'Try again'`).
- The Todo list `<ul>` keeps its element and row keys across the first load: it is one conditionally rendered child in a fixed slot, rendered whenever rows (including Leaving copies) exist, so focus, an open Edit form and an open Delete confirm on an early card survive. The Empty panel renders only when loaded, the cache is empty and no Leaving row remains.
- Hand-off order: Try again moves focus first (add field; heading with `preventScroll` when the last `pointerdown` on it was touch/pen and `detail !== 0`), then `flushSync(retry)`. A removal not caused by a handler is fixed in a layout effect of the removing commit, before any announce, and `document.activeElement` is never `<body>` after it.
- The Loading status decides its line in the same commit as, and after, any focus move (a later layout effect in `TodoList`, or imperative `textContent` on a ref).
- Styling only from `tokens.css` (all needed tokens exist: `--empty-panel-*`, `--skeleton-card-*`, `--list-error-panel-*`, `--try-again-button-*`, `--motion-duration-skeleton`, `--motion-skeleton-iterations`, `--motion-skeleton-opacity-min`, `--motion-ease-in-out`). Breathing only under `prefers-reduced-motion: no-preference`; forced colours give the Empty and List error panels a 1px `CanvasText` border.
- Test titles lead with scenario ids (K5, K6, E5, E6, E8). Every e2e test keeps an axe scan.
- Implementer shell: node 26.13.1 on `PATH`; run only `pnpm typecheck` and `pnpm test`. Docker, Playwright and `pnpm test:all` are the caller's, under the stack lock.

**Never:**
- No change to the store, selector, query function, query policy, mutation helper or Announcer behaviour; no new live region beyond the Loading status; the Announcer never carries a load failure or recovery.
- No change to the API, `packages/contract`, nginx, compose or CI; do not touch `TextField.tsx` / `TextField.module.css`.
- No automatic retry; no test-only switch in app code (e2e failure injection by `page.route` only).
- No merge of the two focus-off-row code paths (story 7's refactor sweep).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First load fast | GET answers < 500 ms | Skeletons, then list or Empty panel; Loading status never non-empty | none |
| First load slow | GET answers after > 500 ms | "Loading your todos" at ~500 ms; on success "Your todos are loaded.", emptied 5 s later | none |
| First load fails | 503 / no response / HTML 500 | List error panel: `Couldn't load your todos.` + reason, Try again; Loading status speaks the same line, empties after 5 s; focus not moved; Add form usable | reason from `lastFetchFailure` |
| New kind while in Error | a focus refetch fails with another kind | Panel reason changes; Loading status silent | none |
| Try again | pressed, no mutation pending | Focus → add field (heading after touch); skeletons at once; fetch now; success → list + "Your todos are loaded." (also > 5 s after the error line emptied); failure → panel again, error line spoken again (a repeat is cleared and set next frame) | as left |
| Try again while a save is pending | early add pending | Skeletons at once; no GET until the save settles; the settle-time refetch is its fetch | as left |
| Error replaced without Try again | focus/reconnect/settle refetch succeeds | Panel → list or Empty panel, no skeletons, no Announcer message. Focus on Try again → the `<ul>` (rows) or Empty panel, and the line is not spoken; focus elsewhere → not moved, "Your todos are loaded." spoken | none |
| Add during Loading / Error | add while skeletons or panel show | Card in the `<ul>` above them; skeletons/panel stay (the cancelled fetch is not a failure); a failed add leaves skeletons/panel, never the Empty panel | add failure announced by the helper |
| Early card across first load | focus, Edit form or Delete confirm open on an early card | Same element after load: focus, draft and confirm kept | none |
| Empty, then add | loaded with zero todos | Empty panel "No todos yet."; an add replaces it with the list | none |
| Last row removed, focus inside | not-found on a toggle/save, refetch removal, failed add, loaded | Focus ends on the Empty panel (for not-found the card's interim target is the `<ul>`; the list area moves it to the Empty panel when the `<ul>` goes) | none |
| Last early row removed, not loaded | failed add of the only early card while focus inside it (incl. toggled while its create was pending) | Focus → the Page heading (Design Notes) | none |

</intent-contract>

## Code Map

- `apps/web/src/components/TodoList.tsx` -- the list area; `useListState()` gives `state`, `todos`; `rows = mergeRows(...)` includes Leaving copies; `listRef`; focus tracking `focusedId` + `handleFocus`/`handleBlur` on the `<ul>` (row ids only) and the refetch focus-move layout effect (l.~170, fallback `list.focus()`); the vanished-edit and vanished-confirm layout effects; `enter` computation. Comment "Epic 2 renders the loading, error and empty states from `state`" is this story.
- `apps/web/src/components/App.tsx` -- passes `focusTargets` (`heading`, `addField` refs) to the Announcer; pass the same to `TodoList` for Try again and the not-loaded fallback.
- `apps/web/src/components/TodoCard.tsx` -- `moveFocusOffRow()` (no operable sibling → `item.closest('ul')`): keep as the interim target, update its doc comment to say the list area then moves focus to the Empty panel. `toggle()` unchanged otherwise.
- `apps/web/src/components/Announcer.tsx` / `Announcer.module.css` -- the touch `lastPointerType` pattern, `leaveDuration` matchMedia pattern, and Dismiss button CSS (copy for Try again, using `--try-again-button-*`).
- `apps/web/src/todos/hooks.ts` -- `useListState`, `useRetryFetch`, `useTodosStore` (`lastFetchFailure`, `loaded`) exist. Read only.
- `apps/web/src/todos/messages.ts` -- `loadError(kind)` exists; add the four strings above (and `messages.test.ts` cases).
- `apps/web/src/todos/announcer.ts` -- `animationFrame` (`NextFrame`) to reuse for the repeat-next-frame rule.
- `apps/web/src/styles/global.css` -- `.visually-hidden` (global class, used by `EditForm`, `TextField`) for the Loading status.
- `apps/web/src/components/TodoList.module.css` -- add list-area, skeleton, Empty panel, List error panel, Try again styles (DESIGN.md Components; tokens in `tokens.css` l.289-319).
- `apps/web/test/render.tsx` -- `renderApp` returns `list: screen.getByRole('list', { name: 'Todos' })` at render time; the `<ul>` no longer exists while loading with no rows, so make `list` a getter (fresh query each access) and fix the call sites that read it before rows exist (`Announcer.component.test.tsx` l.184, 209; `AddForm.component.test.tsx` l.730, 766, 787; `TodoCard.component.test.tsx` l.249, 287) to read it when needed (e.g. inside `waitFor`).
- `liveElement()` helpers in `TodoCard`, `EditForm`, `AddForm`, `Announcer`, `DeleteConfirm` component tests assert exactly one non-form `role="status"`; the Loading status adds one. Give it `data-loading-status` and exclude it in those filters.
- Tests expecting "the list" as the empty fallback, now the Empty panel (ticket Note): `TodoCard.component.test.tsx` l.214 (K6 404 only row), `EditForm.component.test.tsx` l.380 (K3 refetch removes only row).
- `e2e/motion.spec.ts` -- observes `document.querySelector('ul[aria-label="Todos"]')!` right after load of an empty list; observe `main` instead (rows are `li[data-todo-id]`).
- `e2e/helpers.ts` -- add `loadingStatus(page)` (`[data-loading-status]`), `emptyPanel(page)` (text "No todos yet."), `listErrorPanel`/`tryAgain(page)` (button "Try again"), `skeletonList(page)` (`ul[aria-busy="true"]`), and `MESSAGES.loadFailed(reason)`, `MESSAGES.loaded`, `MESSAGES.loading`, `MESSAGES.emptyList`. Note `announcement()` filters by text, so the Loading status never matches it.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/todos/messages.ts`, `messages.test.ts` -- add `loading`, `loaded`, `emptyList`, `tryAgain` strings; test them -- AD-14, EXPERIENCE Voice and Tone.
- [x] `apps/web/src/components/App.tsx` -- pass `focusTargets` to `TodoList`.
- [x] `apps/web/src/components/TodoList.tsx` -- render the list area per Design Notes: Loading status, `<ul>` when rows exist, skeleton list on `loading`, List error panel on `error`, Empty panel on `empty` with no rows; Try again handler; generalised focus tracking and removal effect; Loading status controller (may live in a small sibling module, e.g. `loading-status.ts`, with a pure transition function unit-tested). Update the component doc comment.
- [x] `apps/web/src/components/TodoList.module.css` -- area stack (12px `--space-3` between the `<ul>` with rows and the skeleton list / error panel; no margins), skeleton list and cards (circle 26px, bar 12px at 62/44/54 % widths, breathing 1 → min → 1, 3 iterations, then opacity 1, reduced motion static), Empty panel, List error panel, Try again (hover under `(hover: hover)`, pressed fill + `--motion-press-scale` under no-preference), forced colours -- DESIGN.md Components.
- [x] `apps/web/src/components/TodoCard.tsx` -- `moveFocusOffRow` doc comment only (interim `<ul>`, final Empty panel).
- [x] `apps/web/test/render.tsx` and the existing component tests named in the Code Map -- `list` getter, `liveElement` filter, Empty-panel expectations. No other assertion changes.
- [x] `apps/web/src/components/ListStates.component.test.tsx` (new; `renderApp` + MSW with gated GET) -- one test or more per I/O Matrix row and every K5 bullet in `test-strategy.md`, titled `K5 …`: skeletons (3, aria-hidden, inside `aria-busy`), the Loading status outside `aria-busy` and the swapping part; silent < 500 ms; "Loading your todos" after 500 ms and the recovery line; error panel text per kind and the status line, emptied after 5 s; new kind silent; Try again (focus to add field, heading after a touch `pointerdown`; skeletons at once; `document.activeElement` never `<body>`); Try again while a save is pending (no GET until settle); failed Try again speaks again; recovery > 5 s after the error line; panel replaced by a focus refetch with focus on Try again (→ `<ul>`, → Empty panel; line not spoken) and with focus elsewhere (not moved, line spoken); add during Loading keeps skeletons; failed add during Loading/Error never shows the Empty panel; first load with todos never renders the Empty panel (no commit with it); early card keeps focus, Edit draft and Delete confirm across the first load (same `<ul>` element); Empty panel then add replaces it; Empty panel waits for the last Leaving row; last-row removal → Empty panel (refetch, not-found, failed add, loaded) and → heading (not loaded, incl. a card toggled while its create is pending). K6: Try again's name and keyboard operability; Empty panel and `<ul>` are `tabindex="-1"`, not tab stops. Use real timers with `waitFor` timeouts or fake timers for the 500 ms / 5 s windows, as reliable.
- [x] `e2e/helpers.ts`, `e2e/motion.spec.ts` -- helpers above; observe `main`.
- [x] `e2e/list-states.spec.ts` (new; `beforeEach` `resetList`) -- (a) `E5 E8`: no todos → "No todos yet." visible, axe; add one by keyboard → Empty panel gone, todo listed, axe. (b) `E6 E8` × {503 `UNAVAILABLE_BODY`, `route.abort()`} on GET `/api/todos` before `goto`: panel shows `Couldn't load your todos.` + reason and Try again; Loading status holds the same line; axe; add a todo by keyboard while in Error (POST passes) → it shows above the panel, panel stays; then hold GET behind a gate and remove the failure, Tab to Try again, Enter: focus on the add field, skeleton list visible, "Loading your todos" after 500 ms, axe in loading; release: list shows both todos, Loading status says "Your todos are loaded.", axe.

**Acceptance Criteria:**
- Given the test profile with no todos, when the page loads, then "No todos yet." shows, and adding one by keyboard replaces it with the list, in desktop, phone and desktop-dark, with no axe violations.
- Given `/api/todos` is blocked, when the page is reloaded, then the List error panel shows its reason and Try again; when it is unblocked and Try again is pressed by keyboard, then skeletons show, then the list, and the Loading status holds "Your todos are loaded.".
- Given `pnpm test:all` (caller, under the stack lock), when it finishes, then it exits 0, axe coverage passes, and `coverage/scenarios.md` lists passing K5 and E5 tests.

## Implementation Notes

- The Loading status controller lives in `apps/web/src/components/loading-status.ts`: `stepOf(previous, current)` is the pure transition, `createLoadingStatus({ write, read, nextFrame })` holds the timers and `hasSpoken`; unit-tested in `loading-status.test.ts`. `TodoList` writes the status's `textContent` imperatively through a ref, in a layout effect declared after the focus effect and the vanished-edit/confirm effects. Its `reset()` (layout-effect cleanup) cancels timers and, only before the list is loaded, forgets the previous state, so StrictMode's effect replay re-enters loading rather than going silent, and a loaded list never speaks again.
- Skeleton bar widths (62/44/54 %) are `:nth-child` rules in `TodoList.module.css`, not inline styles (CSP, and DESIGN's "only literals" rule).
- `renderApp().list` is a getter; `renderInError` in the new test uses `Object.assign` rather than a spread, which would evaluate the getter.
- `AddForm.component.test.tsx` "an add failing before the first load …": `items(list)` toEqual `[]` became `queryByRole('list', { name: 'Todos' })` toBeNull, since the `<ul>` goes with its last row (same meaning).
- The hand-off order of Try again is asserted by a `blur` listener on the button (it blurs while still connected, with `relatedTarget` the add field); a MutationObserver alone can't see an in-task drop to `<body>` that the focus effect then repairs.
- The caller ran `pnpm install --frozen-lockfile --prefer-offline` in the fresh worktree (no lockfile change).

**Verification (caller, step 3 and after review patches)**
- `pnpm typecheck`: exit 0. `pnpm test`: 25 files, 543 tests before review (baseline 487), 550 after the review patches, all passing.
- `pnpm test:all` under `/tmp/todo-test-stack.lock`, twice (before and after the review patches): exit 0 both times, every step passed; e2e 111 passed in desktop, phone and desktop-dark, including `list-states.spec.ts` and `motion.spec.ts`. `coverage/scenarios.md`: K5 (54), K6, E5 (component and all three e2e projects), E6, E8 pass. todo-test was torn down each time.
- Manual, on todo-test with a Pixel 7 Chromium in the dark scheme: with no todos, "No todos yet." showed; an add by keyboard replaced it. Then every method on `/api/todos` routed to 503 and the page reloaded: the panel read "Couldn't load your todos. The server isn't available right now. Try again in a moment." with Try again, and the Loading status held the same line. Unblocked (GET held), Tab to Try again, Enter: focus on the "New todo" field, 3 skeleton cards, "Loading your todos" after 700 ms; released: the list, no skeletons, the Loading status "Your todos are loaded.". The stack was then taken down.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 23, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind-hunter) e2e `announcement()` can match the Loading status, so `announcement(page, /./).toHaveCount(0)` checks flake on a slow first load. — Verified: the locator excluded only `form [role="status"]`; "Loading your todos" stays until loaded. Fixed: the locator also excludes `[data-loading-status]`.
  - `[low]` `[reject]` (blind-hunter) No StrictMode integration test of the Loading status. — StrictMode double-invokes effects only in development builds; `reset()` is unit-tested for the replay. A StrictMode render harness is more than a direct correction.
  - `[low]` `[patch]` (blind-hunter) The Empty panel → rows focus branch (`'empty'` → `<ul>`) is untested. — Same root cause as verification-gap row 1; fixed there.
  - `[low]` `[patch]` (blind-hunter) The reconnect refetch replacing the panel (K5) is untested. — Fixed: the recovered-without-Try-again tests run for a focus refetch and an `onlineManager` reconnect.
  - `[low]` `[patch]` (blind-hunter) The not-loaded heading fallback is tested only in Error. — Fixed: a Loading case (only early card's add fails while focused → heading, skeletons stay).
  - `[low]` `[patch]` (blind-hunter) "an add during Error" ends with the POST and its refetch in flight. — Verified (last statement `created.open()`). Fixed: waits for "Added", the second GET and an idle query.
  - `[low]` `[patch]` (blind-hunter) Skeleton circle and bars vanish under forced colours (background only). — Verified: forced colours replace author backgrounds. Fixed: `forced-color-adjust: none; background: GrayText` for both.
  - `[low]` `[reject]` (blind-hunter) The 12px area gap snaps when the only early card leaves during Loading/Error. — Cosmetic, 200 ms, rare (delete before first load); tying the gap to a live row is more than a direct correction. Same accepted trade-off as 2.5's last-row gap.
  - `[low]` `[reject]` (blind-hunter) The skeleton `<ul aria-busy>` with all-hidden items may be read as an empty list. — EXPERIENCE IA specifies `<ul aria-busy="true">` with each Skeleton card hidden; changing it departs from the spec.
  - `[low]` `[reject]` (blind-hunter) Try again's touch/keyboard hand-off duplicates Announcer's Dismiss logic. — Real duplication; merging shared focus paths is story 7's refactor sweep, and an extracted hook adds surface.
  - `[false]` `[reject]` (blind-hunter) `lastFetchFailure ?? 'generic'` can give a wrong reason silently. — `selectListState` returns `error` only when `lastFetchFailure !== null`; the `??` only narrows the type.
  - `[low]` `[reject]` (blind-hunter) The error panel has no stable selector for tests. — Test-side brittleness only; tests would fail loudly on a layout change.
  - `[low]` `[reject]` (blind-hunter) The plan's Verification has no results. — Its fix is to edit this build's plan; results are recorded in Implementation Notes and Auto Run Result at finalize.
  - `[low]` `[patch]` (edge-case-hunter) After a repeat `say()`, a 5 s clear firing before the deferred frame (hidden tab) lets the frame write the line back for good. — Verified in `loading-status.ts`. Fixed: a `clear()` cancels any pending frame before emptying; unit test added.
  - `[low]` `[patch]` (edge-case-hunter) `regainFocus()` leaves `focusManager.setFocused(true)` across tests. — Verified (no reset in `afterEach`). Fixed: `afterEach` resets `focusManager`, `onlineManager` and mocks.
  - `[low]` `[reject]` (edge-case-hunter, claim) "No other assertion changes" vs the AddForm `items(list)` → no-list change. — The change is forced by the `<ul>` going with its last row, keeps the meaning, and is recorded in Implementation Notes.
  - `[low]` `[patch]` (verification-gap) Focus on the Empty panel, then a refetch bringing rows: no test. — Pre-verified. Fixed: new K5 test (focus ends on the Todo list); fails with the `'empty'` case removed.
  - `[low]` `[patch]` (verification-gap) Focus while only Leaving rows remain and the move to the Empty panel when the last Leaving copy unmounts: no test. — Pre-verified. Fixed: new test with held leave timers (`<ul>`, then Empty panel); fails with the effect limited to `[todos]`.
  - `[low]` `[reject]` (intent-alignment) "Spoken" is checked as live-region text, not speech. — No automated test can assert speech; story 9 runs the screen-reader pass (epic Decision 2026-11-25).
  - `[low]` `[reject]` (intent-alignment) E2e blocks GET only, before the first navigation, rather than blocking the endpoint and reloading. — Equivalent app state; the caller's manual check blocked every method and reloaded (Implementation Notes).
  - `[low]` `[patch]` (intent-alignment) The not-found two-hop focus (`<ul>`, then Empty panel) was asserted only at its end. — Fixed: the test holds the settle-time refetch and asserts the interim `<ul>` stop.
  - `[low]` `[reject]` (intent-alignment) Note 2's not-loaded target (heading) is a build decision recorded only in the plan. — Recorded in Design Notes with its reason; EXPERIENCE has no Empty panel before the first load. Loading coverage added via the blind-hunter row above.
  - `[low]` `[patch]` (intent-alignment) Reconnect and settle-time replacement of the panel not exercised. — Same root cause as the blind-hunter reconnect row; fixed there (the code reads only the list state, so the settle-time path is the same).
  - `[low]` `[reject]` (intent-alignment) Try again's touch branch runs only with synthetic events. — Same pattern and coverage level as Dismiss; e2e E8 is keyboard-only by design.
  - `[low]` `[reject]` (intent-alignment) Skeleton breathing, hover, press and forced colours have no automated check. — Every e2e project reduces motion (AD-20); extending the one motion-on spec is more than a direct correction. Same rejection as 2.5.

## Design Notes

**Render shape** (fixed slots, so the `<ul>` keeps its element):
```tsx
<div className={styles.area} onFocus={trackFocus} onBlur={trackBlur}>
  <p ref={statusRef} role="status" className="visually-hidden" data-loading-status />
  {rows.length > 0 && <ul ref={listRef} role="list" aria-label="Todos" tabIndex={-1} …>{…}</ul>}
  {state === 'loading' && <ul aria-busy="true" className={styles.skeletons}>{3 × <li aria-hidden="true">…}</ul>}
  {state === 'error' && <div className={styles.errorPanel}><p>{loadError(lastFetchFailure)}</p><button>Try again</button></div>}
  {state === 'empty' && rows.length === 0 && <p ref={emptyRef} tabIndex={-1} className={styles.empty}>No todos yet.</p>}
</div>
```

**Focus tracking:** track `{ kind: 'row', id } | { kind: 'list' } | { kind: 'empty' } | { kind: 'panel' } | null` from focusin/focusout on the area (same blur rules as today). In one layout effect per commit (no deps, cheap), when the tracked element is gone and focus is on `<body>`/null:
- row → the after-delete rule among non-Leaving rows (existing index logic); none left → fallback.
- list (`<ul>` unmounted) → fallback. empty (Empty panel replaced by rows) → the `<ul>`. panel (replaced by a refetch's success) → the `<ul>` if rendered, else the Empty panel.
- fallback: the Empty panel if rendered; else the `<ul>` if rendered (only Leaving rows left); else (not loaded) the Page heading, `preventScroll`.
Record `movedToList = true` when the target is the `<ul>` or the Empty panel. **Decision (not-loaded fallback):** EXPERIENCE sends an emptied list's focus to the Empty panel "because no activation decides between field and heading", but before the first load there is no Empty panel; the heading is the target with the Empty panel's properties (not actionable, no phone keyboard), so it is used.

**Loading status controller** (refs + timers, cleared on unmount): previous state in a ref. Each commit, after the focus effect:
- entering `loading` (from anything not `loading`, including mount): clear timers, empty, start 500 ms → say `loading`.
- entering `error`: clear timers, say `loadError(kind)`, start 5 s → empty.
- becoming loaded (prev `loading`/`error`): clear timers; if `hasSpoken && !movedToList` say `loaded` and start 5 s → empty, else empty. Then silent for good.
- `say(text)` sets `hasSpoken`; if the current text equals `text`, empty now and set it on the next animation frame.

**Try again:** `pointerdown` records the pointer type; click: focus target first, then `flushSync(retry)`.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0.
- `pnpm test` -- expected: all pass, including the new K5/K6 tests and the updated helpers (baseline 487).
- `pnpm test:all` (caller, holding `/tmp/todo-test-stack.lock`) -- expected: exit 0; e2e passes in desktop, phone and desktop-dark including `list-states.spec.ts` and `motion.spec.ts`; axe coverage passes; `coverage/scenarios.md` lists K5 and E5.

**Manual checks:**
- On todo-test, a script-driven Chromium: with GET `/api/todos` routed to 503, reload: the panel, its reason and Try again; unroute, Tab to Try again, Enter: skeletons, then the list; the Loading status reads "Your todos are loaded.". Then take the stack down.

## Auto Run Result

**Status:** built

**Summary:** The list area now renders AD-11's list states from epic 1's selector.
- **Loading:** three Skeleton cards, each hidden from assistive tech, in a `<ul aria-busy="true">`; they breathe three times under motion, static under reduced motion.
- **Error:** the List error panel shows `Couldn't load your todos.` plus the reason from the store's last fetch failure, and Try again. Try again moves focus to the add field (the heading after a tap), then shows the skeletons at once; its fetch waits for any pending save.
- **Empty:** the Empty panel "No todos yet." (`tabindex="-1"`), only once loaded with no row left, Leaving copies included.
- **The Todo list `<ul>`** renders whenever it has rows, in a fixed slot, so an early card keeps its element, focus, Edit form and Delete confirm across the first load.
- **Loading status:** one always-mounted, visually hidden `role="status"`: "Loading your todos" after 500 ms of loading, the panel's line on entering Error (emptied 5 s later; a new kind while in Error is silent; a repeat is re-set on the next frame), and "Your todos are loaded." once when the list becomes loaded, only if it spoke before and focus did not move to the list.
- **Focus:** the list area tracks focus on a row, the list, the Empty panel or the panel. When a refetch, a failed add or the end of a leave motion removes the focused element, focus goes to the after-delete target, an emptied list's Empty panel (ticket Note 1: a not-found's interim `<ul>` target moves on to it), the Todo list when the panel or Empty panel is replaced, and the Page heading before the first load (ticket Note 2, Design Notes decision).

**Files changed:**
- `apps/web/src/components/TodoList.tsx`: list states, Loading status wiring, Try again, generalised focus tracking.
- `apps/web/src/components/loading-status.ts` (new) and `loading-status.test.ts` (new): the Loading status controller and its unit tests.
- `apps/web/src/components/TodoList.module.css`: area stack, skeletons, Empty panel, List error panel, Try again, forced colours.
- `apps/web/src/components/App.tsx`: passes the focus targets to the list area. `TodoCard.tsx`: doc comment only.
- `apps/web/src/todos/messages.ts`, `messages.test.ts`: `loading`, `loaded`, `emptyList`, `tryAgain`.
- `apps/web/src/components/ListStates.component.test.tsx` (new): K5 and K6.
- `apps/web/test/render.tsx` and the `AddForm`, `Announcer`, `DeleteConfirm`, `EditForm`, `TodoCard` component tests: `list` getter, Loading status excluded from `liveElement`, Empty-panel focus targets.
- `e2e/list-states.spec.ts` (new): E5, E6, E8. `e2e/helpers.ts`: list-state helpers, `MESSAGES` entries, `announcement()` excludes the Loading status. `e2e/motion.spec.ts`: observes `main`.

**Review:** thorough (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 25 findings: high 0, medium 1, low 23, false 1.
- **Patched (12 rows; entries medium 1, low 9):** the e2e `announcement()` matching the Loading status; the repeat frame outliving the 5 s clear; skeleton shapes under forced colours; `focusManager` leaking between tests; a test ending with a request in flight. Tests added for Empty panel → rows focus, focus through the Leaving-only list to the Empty panel, reconnect recovery, the heading fallback during Loading, and the not-found interim `<ul>` stop.
- **Deferred:** none.
- **Rejected:** StrictMode harness (dev-only, unit-tested); 12px gap snap before first load (cosmetic, 200 ms); `aria-busy` skeleton list (spec-mandated); Try again / Dismiss duplication (story 7); error panel test selector; plan Verification results (plan edit); the AddForm assertion change (forced, same meaning, recorded); live-region text versus speech (story 9's pass); GET-only block in e2e (manual check covered the literal block and reload); heading decision record (in Design Notes); synthetic touch for Try again; motion and visual checks (all e2e reduce motion); and 1 false finding (`?? 'generic'`). Reasons in the Review Triage Log.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 1, low 9 (entries).

**Verification:**
- `pnpm typecheck`: exit 0. `pnpm test`: 550 tests pass after the patches.
- `pnpm test:all` under the stack lock, twice (before and after the review patches): exit 0, every step passed, e2e 111 passed; `coverage/scenarios.md` lists K5, K6, E5, E6 and E8 passing.
- Manual on todo-test (Pixel 7, dark): the Empty panel and its replacement; with `/api/todos` blocked and the page reloaded, the panel and its line; Try again by keyboard, skeletons, "Loading your todos", the list and "Your todos are loaded." (Implementation Notes).

**Residual risks:**
- Production Verify runs only after merge and deploy.
- The not-found on the last row stops on the `<ul>` for a round trip before the Empty panel; a screen reader hears both.
- The Page heading as the not-loaded fallback is a build decision (Design Notes), not in EXPERIENCE.
- Three component tests use fake timers with `shouldAdvanceTime` for the 5 s windows; they passed every run here.
