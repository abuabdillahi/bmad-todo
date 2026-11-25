---
title: 'A user completes and reactivates a todo, and a completed todo looks done'
type: feature
ticket: '3'
created: '2026-11-25'
status: built
baseline_revision: '0bc3c01197f7b241f51eae12dc6510b99b9c1cce'
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
      When a toggle's 404 (deleted elsewhere) leaves the list empty and focus was in the row, focus goes to the Todo list, not EXPERIENCE's Empty panel.
    evidence: |-
      EXPERIENCE Focus management (Row removed by not-found ... an empty list sends focus to the Empty panel). The Empty panel is built by story 6 (list states); until then TodoCard.tsx falls back to the list's <ul tabindex="-1">. Story 6 should retarget it.
    location: >-
      apps/web/src/components/TodoCard.tsx toggle()
    severity: low
---

<intent-contract>

## Intent

**Problem:** A todo card shows only its text: a user cannot mark a todo done or reopen it, and nothing looks done (R4, R6). The e2e specs still share one list across tests, relying on unique descriptions alone (retrospective F3, AD-20).

**Approach:** The card gets DESIGN.md's Completion check (a native checkbox under a decorative SVG circle and tick) and the Done chip, with the done treatment in light and dark. A toggle goes through AD-13's helper as a `follow-up` calling story 2's `PATCH /api/todos/{id}` with `{ completed }`: it shows at once, reverts with the `complete` or `reopen` message (or `deletedElsewhere` on a 404) and the revert flag when the save fails. Every e2e spec empties the list through the public API (`GET`, then `DELETE` each) in `beforeEach`, with the shared helpers in `e2e/helpers.ts`.

## Boundaries & Constraints

**Always:** Components change todos only through hooks in `apps/web/src/todos/` (AD-11), and the toggle only through the one helper (AD-13): a call on a todo whose create is pending waits for it and is dropped if it fails. Every message comes from `messages.ts` (`lead.complete`, `lead.reopen`, `deletedElsewhere`), each quoted with `quote()`. A successful toggle announces nothing. The list keeps the server's order (no re-sort, AD-11). The checkbox's name comes from `aria-labelledby` pointing at a span holding only the todo text. The Done chip is that span's sibling, `aria-hidden`. All styling uses the existing tokens in `tokens.css` (DESIGN.md Components › Todo card, Completion check, Done chip, Revert flag). Motion transitions only opacity, colour, `stroke-dashoffset` and `outline-color`, and only under `prefers-reduced-motion: no-preference`. The shadow and the dashed outline each sit on their own layer and fade by opacity. Test titles lead with scenario ids, and every e2e test keeps an axe scan. Implementer shell: put node 26.13.1 (`$HOME/.nvm/versions/node/v26.13.1/bin`) on `PATH` and run only `pnpm typecheck` and `pnpm test`. `pnpm test:all`, Playwright and every docker command are the caller's to run, under the shared todo-test stack lock.

**Never:** No Edit or Delete buttons, Edit form, Delete confirm, Empty panel, loading or error panel (stories 4–6). No list-area "deleted elsewhere" for an edit-mode row (story 4, no edit mode exists yet). No saving indicator, toast or second live region (AD-14). No new message string in `messages.ts`, and no new `FailureKind` or problem type. No change to the API, `packages/contract`, `openapi.json`, nginx, compose or CI. No test-only switch or route in app code (AD-20). No e2e failure injection other than `page.route`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Complete | Active todo, the check activated by click, tap or Space | At once, before the server answers: checked, Done chip, done card. `PATCH {"completed":true}` is sent. Focus stays on the check. Nothing is announced. | No error expected |
| Reopen | Done todo, the check activated | At once: unchecked, no chip, active card. `PATCH {"completed":false}` is sent. Nothing is announced. | No error expected |
| Save fails | PATCH answers 503, 500, a non-problem error, or no response (including the 15 s write timeout) | The todo returns to its previous state. `revertedAt(id)` is recorded, and the revert flag shows for 1.2 s. Focus is not moved. The list stays usable. | `Couldn't mark “{t}” done, so it's still open.` or `Couldn't reopen “{t}”, so it's still done.` plus the kind's reason, kind `failure` |
| Deleted elsewhere | PATCH answers 404 | Reverted and flagged as above. If focus was inside the row, it moves when the promise resolves, to the next row's check, else the previous row's, else the Todo list. The row unmounts on the settle-time refetch. | `“{t}” was deleted elsewhere.`, kind `failure` |
| Toggle while the create is pending | Card added, its POST not yet answered | The card shows done at once. The PATCH is sent only after the POST settles. | If the create fails, the toggle is dropped: not sent, announced or reverted. Only the add failure is announced. |
| Two quick toggles | Complete, then reopen, before either answers | Sent in order. The card shows the last state. | If the first fails, the second's change is re-applied on the restored value (the helper's existing revert) |
| Card mounts inside the flag window | `revertedAt(id)` is less than 1.2 s old when the card mounts | The flag shows for the time that remains, then goes | none |

</intent-contract>

## Code Map

- `apps/web/src/api/client.ts` -- `request()` already arms `WRITE_TIMEOUT_MS` for every non-GET. Add `updateTodo(id, body: UpdateTodoBody): Promise<Todo>`: `PATCH /api/todos/${encodeURIComponent(id)}` with a JSON body and `Content-Type`, like `createTodo`. Import types only from `@todo/contract`, which already exports `UpdateTodoBody`.
- `apps/web/src/todos/mutations.ts` -- `MutationHelper` (`run`, `addTodo`). Add `setCompleted(todo: Pick<Todo, 'id' | 'description'>, completed: boolean): Promise<MutationOutcome>` with `run({ id, kind: 'follow-up', apply: prev => prev ? { ...prev, completed } : null, send: () => updateTodo(id, { completed }), failureText })`. `failureText` returns `messages.deletedElsewhere(description)` for `not-found`, else `messages.failureMessage(completed ? 'complete' : 'reopen', failure, description)`. No `successText`. `run`, `revert`, `execute` and `settle` already handle the ordering, drop, revert record and refetch: do not change them.
- `apps/web/src/todos/hooks.ts` -- add `useSetCompleted()` (returns `mutations.setCompleted`) and `useRevertedAt(id): number | undefined` (`useSyncExternalStore` selecting `store.getSnapshot().revertedAt.get(id)`, so a card re-renders only when its own record changes).
- `apps/web/src/todos/store.ts` -- `recordRevert` and `revertedAt` exist already. No change expected.
- `apps/web/src/todos/messages.ts` -- every string exists already. Read only.
- `apps/web/src/components/TodoCard.tsx` -- today `<li>` › `.body` › `.card` › `<span className={styles.text}>`, with the `enter` motion. Add the check, the text span (`useId` id), the chip, the done class, the revert flag and the toggle handler. Keep the `li` › `.body` › `.card` nesting and the enter motion.
- `apps/web/src/components/TodoCard.module.css` -- `.card` (flex, `align-items: flex-start`, gap, shadow) and `.text` exist. Card tokens are `--todo-card-*`, `--todo-card-done-*`, `--completion-check-*`, `--done-chip-*`, `--revert-flag-*`, `--focus-ring-*`, `--motion-duration-base`, `--motion-duration-revert`, `--motion-ease-out`, `--motion-ease-in-out`, `--font-chip-*` and `--font-todo-*`. The dark values come from `tokens.css`'s `prefers-color-scheme` block, so no per-scheme CSS is needed. Reference construction: `_bmad-output/initiative-todo-app/ux-todo-app/mockups/key-motion-and-buttons.html` lines 120–135 and 220–228 (`.check`, `.ck`, `.chip`, `.mcard::before/::after`), and lines 398–402 (forced colours).
- `apps/web/src/components/TodoList.tsx` -- renders `<TodoCard key todo enter>` in a `<ul role="list" aria-label="Todos" tabIndex={-1}>`. No change expected; the card can reach siblings through its `li` ref.
- `apps/web/src/components/App.module.css` -- `.app` paints a background, and its global `:focus-visible` ring also lands on the (invisible) input. So the shadow layer needs `isolation: isolate` on `.card`, and the visible ring goes on the SVG.
- Tests to extend or copy: `apps/web/src/api/client.test.ts` (`fetchMock`), `apps/web/src/todos/mutations.test.ts` (`setup`, `held`, `flush`, `problem`, `completeSpec`), `apps/web/test/render.tsx` (`renderApp`, `children` render inside the provider), `apps/web/src/components/AddForm.component.test.tsx` (MSW `serve` and `gate` patterns, `NOT_STATUS`, `liveElement`).
- `e2e/helpers.ts` -- shared `focusAddField`, `uniqueDescription`, `todoList`, `todoItem`, `quoteText`, `announcement`, `MESSAGES`, `UNAVAILABLE_BODY`. The specs `todos`, `refresh`, `add-failure`, `offline`, `validation` and `motion` have no `beforeEach` today. Playwright's `request` fixture uses the config's `baseURL`. Story 2 found that a DELETE sent with a JSON `Content-Type` and an empty body gets an undocumented 400, so send DELETE with no body and no content type.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/api/client.ts` -- add `updateTodo` -- AD-5, AD-6.
- [x] `apps/web/src/todos/mutations.ts`, `hooks.ts` -- add `setCompleted`, `useSetCompleted` and `useRevertedAt` as in the Code Map -- AD-13.
- [x] `apps/web/src/components/TodoCard.tsx`, `TodoCard.module.css` -- build the check, chip, done treatment, revert flag and toggle (Design Notes) -- R4, R6, R7.
- [x] `apps/web/src/api/client.test.ts` -- `U3` tests: `updateTodo` sends PATCH to the encoded path with the JSON body and returns the todo, and a 404 problem rejects `not-found`.
- [x] `apps/web/src/todos/mutations.test.ts` -- through `helper.setCompleted`: U3 complete and reopen apply at once, send `{completed}` and announce nothing. U4: a failure reverts only that todo, records the revert and announces the right lead plus reason, for complete and for reopen. U4: a 404 announces `deletedElsewhere` with no lead or reason. U5: a toggle behind a pending create is sent after it, and is dropped when the create fails.
- [x] `apps/web/src/components/TodoCard.component.test.tsx` (new, through `renderApp` and MSW) -- K2: active and done render distinctly (checked state, chip, done class). A click or Space toggles at once, before the server answers (gate), and sends the body. K6: the check is named by the todo text alone (no "Done"), is reached by Tab after the Add button, and keeps focus after a toggle. A failing PATCH reverts, announces, and shows the flag, which is gone after about 1.2 s. A 404 announces deleted elsewhere, moves focus to the next row's check (and to the list when it is the only row), and the row is gone after the refetch. A card mounting with a recent `revertedAt` is flagged for the time that remains.
- [x] `e2e/helpers.ts` -- add `resetList(request)` (GET `/api/todos`, then DELETE each id, expecting 204 or 404), `createTodo(request, description, completed?)` (POST with a fresh UUID, then PATCH when `completed`), `completionCheck(page, description)`, and `MESSAGES.completeFailed(t, reason)`, `reopenFailed(t, reason)` and `deletedElsewhere(t)`. Update the module comment -- AD-20.
- [x] `e2e/todos.spec.ts`, `refresh.spec.ts`, `add-failure.spec.ts`, `offline.spec.ts`, `validation.spec.ts`, `motion.spec.ts` -- `test.beforeEach(({ request }) => resetList(request))` at the top of each. Drop the "Epic 2 adds the AD-20 reset" comment. Keep behaviour and axe scans -- AD-20, F3.
- [x] `e2e/complete.spec.ts` (new, with the same `beforeEach`) -- (a) `E2 E7 E8`: a todo set up through the API. By keyboard (Tab from the add field past Add to the check, then Space), with the PATCH held by `page.route`: checked, chip visible and the text's computed colour changed while the PATCH is held. Then it is still done after the answer and after a reload. Space reopens it (no chip, the colour back), and it is still active after a reload. Axe scans when done and when reopened. (b) `E6 E8` × {complete, reopen} × {503 `UNAVAILABLE_BODY`, `route.abort()`}: the check reverts, the banner shows the lead plus reason, focus stays on the check, an axe scan runs, and after `unroute` the same toggle succeeds. (c) `E6 E8` deleted elsewhere: two todos, the focused one deleted through `request.delete`, then Space. The banner says it was deleted elsewhere, focus is on the other todo's check, and the row is gone after the refetch -- E2, E6, E7, E8.

**Acceptance Criteria:**
- Given the test profile with a todo, when a user Tabs to its completion check and presses Space, then before the save answers it shows checked, with the Done chip and receded text, in the desktop, phone and desktop-dark projects. After a reload it is still done, and Space then makes it active again, which also survives a reload.
- Given the save fails (503 or no response), when a user completes or reopens a todo, then it returns to its previous state, the banner gives the matching lead and reason, and the next toggle works.
- Given any e2e spec, when its tests run, then each test starts from a list emptied through the public API by the shared `resetList` (`grep -L "resetList" e2e/*.spec.ts` prints nothing).
- Given `pnpm test:all` (run by the caller under the stack lock), when it finishes, then it exits 0, axe coverage passes, and `coverage/scenarios.md` lists passing U3, K2 and E2 tests.

## Implementation Notes

- `e2e/helpers.ts` declares a local `Todo` interface: the e2e package does not depend on `@todo/contract`, and adding the dependency would change `e2e/package.json` and the lockfile.
- `TodoCard.module.css`: a card that entered keeps `todo-card-in` listed on `.enter .card`, which would override the flag's `animation`, so `.enter .flagged` lists both. A second revert inside the 1.2 s window extends the flag but does not restart the CSS pulse.
- A done card loaded with motion on fades its Done chip in once on first load (`@starting-style` applies to any mounted chip). This lasts 200 ms and does not happen under reduced motion.
- Verified locally: `pnpm typecheck` exit 0, `pnpm test` 390 passed, `grep -L "resetList" e2e/*.spec.ts` prints nothing. Not run (caller, under the stack lock): `pnpm test:all`, Playwright, the manual api-stopped check.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 33 findings — high 0, medium 0, low 28, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind-hunter) The component test's MSW `serve()` PATCH handler applied the last recorded body, not its own, so two held PATCHes would apply the wrong change. Verified in the handler. Fixed: each handler applies the body it parsed.
  - `[low]` `[reject]` (blind-hunter) After a 404, a second toggle already queued on the same id is still sent, 404s again, and announces "deleted elsewhere" a second time. This is real. It needs two toggles queued on a todo deleted elsewhere within one round trip. The repeat only re-speaks the same message, and the focus guard stops a second move. The fix adds chain state to AD-13's helper, so it is more than a direct correction.
  - `[low]` `[patch]` (blind-hunter) No real-browser check of the done card's layered paint (the `::before` shadow and the `::after` dashed outline). Only the text colour was compared. Fixed: E2 asserts the pseudo-element opacities when done and after reopening.
  - `[low]` `[patch]` (blind-hunter) The matrix says "click, tap or Space", but no real-browser test uses a pointer on the check. Fixed: a new E2 E7 test taps the check (phone) or clicks it (desktop).
  - `[low]` `[patch]` (blind-hunter) Under forced colours the circle kept its author fill, so a CanvasText tick could sit on a pale fill. Fixed: the circle's fill is `Canvas` under `forced-colors`.
  - `[low]` `[reject]` (blind-hunter) `resetList` empties whatever origin `E2E_BASE_URL` names, with no guard. The variable defaults to todo-test and only `pnpm test:all` sets it. Pointing it elsewhere is a deliberate act that already wrote todos there before this change, and a guard adds configuration.
  - `[low]` `[reject]` (blind-hunter) The `beforeEach` is copied into seven specs instead of being a shared auto fixture, so a future spec could forget it. The intent asks for a `beforeEach` in every spec, and the grep acceptance check catches a spec without it. Moving every spec to an extended `test` is more than a direct correction.
  - `[low]` `[patch]` (blind-hunter) `resetList` never confirmed the list ended up empty. Fixed: it lists again and expects `[]`.
  - `[low]` `[patch]` (blind-hunter) The `workers: 1` comment in `playwright.config.ts` still gave the old reason. Fixed: it says each test empties the whole list.
  - `[low]` `[patch]` (blind-hunter) The revert flag's coverage was partial: no test of a second revert extending it. Grouped with the verification-gap flag-extension row. Fixed there. An e2e flag check was not added, because reduced motion holds a static outline for only 1.2 s.
  - `[low]` `[reject]` (blind-hunter) The flag component tests use real timers with wall-clock bounds. They passed five reruns and in `pnpm test:all`. Rewriting them to fake timers is more than a direct correction.
  - `[low]` `[patch]` (blind-hunter) The deleted-elsewhere e2e can't tell next-row from previous-row focus. Grouped with the verification-gap middle-row row. Fixed by the component test that pins next before previous.
  - `[low]` `[patch]` (blind-hunter) `createTodo` in `e2e/helpers.ts` did not encode the id in its PATCH path. Fixed: it uses `encodeURIComponent`.
  - `[low]` `[patch]` (blind-hunter) The `--todo-card-done-shadow` token is never read. Fixed: a comment at `.done::before` says the done card's no-shadow comes from fading the shadow layer, because box-shadow is not animated.
  - `[low]` `[reject]` (edge-case-hunter) A second revert inside the 1.2 s window ends the CSS pulse at its first 1.2 s and shows a solid outline until the class drops. This is cosmetic: it is still a revert flag. It needs two failures within 1.2 s, and restarting the animation needs extra state.
  - `[low]` `[reject]` (edge-case-hunter) A card mounting mid-window starts the pulse at 0%, and the class is removed mid-pulse. No path in this story mounts a card inside the window (that is a failed delete's restored row, story 5). The fix (a negative animation delay) adds per-render style.
  - `[low]` `[reject]` (edge-case-hunter) If a toggle is queued behind a pending create, the create fails, and the check has focus, the row unmounts and focus falls to `<body>`. This is real, and newly reachable because cards now hold a focusable control. It needs a keyboard toggle within the create's round trip followed by the create failing. Fixing it needs the list area's removed-row focus tracking (EXPERIENCE Focus management, "Row removed by … a failed add"), which is more than a direct correction. Noted for the list-states story.
  - `[low]` `[reject]` (edge-case-hunter) A second queued toggle after a 404 sends another PATCH and announces again. Same root cause as the blind-hunter row; rejected there.
  - `[low]` `[patch]` (edge-case-hunter) The test server applies the last body to the wrong todo. Same root cause as the first blind-hunter row; fixed there.
  - `[low]` `[patch]` (verification-gap) Next-before-previous focus after a 404 was untested: no case had a row with both neighbours. Fixed: a three-row case removes the middle row and expects focus on the next row's check.
  - `[low]` `[patch]` (verification-gap) Nothing tested that a 404 leaves focus alone once the user has moved it out of the row. Fixed: a component test moves focus to the add field before the 404 and asserts it stays there.
  - `[low]` `[patch]` (verification-gap) A second revert inside the window extending the flag was untested. Fixed: a component test records two reverts about 600 ms apart.
  - `[low]` `[reject]` (intent-alignment) Production Verify is not exercised. It can only run after the PR merges and CI deploys, and this run must not merge. It is left to the user's production check.
  - `[false]` `[reject]` (intent-alignment) The stopped-api Verify is only an unexecuted manual check. Refuted: it was run on todo-test with `docker compose -p todo-test stop api`, in light and dark (Auto Run Result).
  - `[false]` `[reject]` (intent-alignment) "The list stays usable" is checked only by re-toggling the same check. Refuted for the outcome: with the api stopped, the manual Verify toggled a second todo and added through the add field, and each failed cleanly with its message while the list stayed. The e2e's next toggle succeeds after `unroute`.
  - `[low]` `[patch]` (intent-alignment) The done styling was asserted only as "different text colour", not the dashed outline or dropped shadow. Same root cause as the blind-hunter layered-paint row; fixed there.
  - `[low]` `[patch]` (intent-alignment) The revert flag is tested only in jsdom. Same root cause as the blind-hunter flag-coverage row; the extension test was added there.
  - `[low]` `[reject]` (intent-alignment) R11's new-session and server-restart persistence is not tested for completion. The ticket's own Verify asks only for a refresh. Completion is stored in the same row and through the same SQLite path that E1's new-session check and I6's restart test already prove. The app holds no client-side state across sessions.
  - `[low]` `[reject]` (intent-alignment) A client classification test (404 rejects `not-found`) is tagged U3. The tag is cosmetic, and it is the U3 client path's error case.
  - `[false]` `[reject]` (intent-alignment) The list-area "deleted elsewhere" caller is not built. Refuted: AD-14 and EXPERIENCE give that caller only to a row in edit mode, and edit mode does not exist until story 4. On a toggle, EXPERIENCE's Not-found row has the helper announce it, as built.
  - `[low]` `[defer]` (intent-alignment) When a 404 empties the list, focus goes to the Todo list, not EXPERIENCE's Empty panel. The Empty panel does not exist yet (story 6). Deferred for story 6.
  - `[false]` `[reject]` (intent-alignment) Story 10's quote is untested through these messages. Refuted: these messages call the same `quote()` through `messages.ts`, and story 10's tests already quote a cut grapheme in the complete-failure and deleted-elsewhere messages.
  - `[false]` `[reject]` (intent-alignment) The reset was exercised only by e2e runs the caller had not run. Refuted: `pnpm test:all` ran under the stack lock and passed, e2e 63 tests in three projects.

## Design Notes

Card markup (one `useId` per card):

```tsx
<div className={cardClass}>            {/* styles.card + styles.done when completed + styles.flagged while flagged */}
  <span className={styles.check}>
    <input type="checkbox" checked={todo.completed} onChange={toggle} aria-labelledby={textId} />
    <svg className={styles.circle} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <circle cx="13" cy="13" r="12" /><path d="M3.5 8.4l3 3 6-6.8" transform="translate(5 5)" />
    </svg>
  </span>
  <div className={styles.content}><span id={textId}>{todo.description}</span>{todo.completed && <span className={styles.chip} aria-hidden="true">Done</span>}</div>
</div>
```

- The checkbox is controlled by the cached `todo.completed`, with no local copy (AD-11). `toggle` reads `event.currentTarget.checked`, awaits `setCompleted(todo, checked)`, and on `failed` with `not-found` moves focus, if `li.contains(document.activeElement)`, to `li.nextElementSibling`'s checkbox, else the previous sibling's, else `li.closest('ul')`. The Empty panel arrives with story 6. Other failures leave focus alone.
- The input is `position: absolute; inset: 0; margin: 0; opacity: 0; appearance: none; z-index: 1` over a 44×44 `.check` (`margin: var(--completion-check-margin)`, grid, centred). The ring is drawn on the SVG: `input:focus-visible + svg { outline: ring }`. The states use `input:checked + svg`, `:hover` (only in `@media (hover: hover)`) and `:active`, per DESIGN.md Completion check.
- Done card: `background` and the solid `border-color` go transparent, and `color` goes to `--todo-card-done-foreground`. `.card::before` (inset by minus the border width, `box-shadow`, `z-index: -1`) fades to opacity 0. `.card::after` (the dashed `--todo-card-done-border-color` border) fades to opacity 1. `.card` gets `isolation: isolate`, so the shadow layer is not painted under `.app`'s background. The chip fades in with `@starting-style` and is removed at once on reopen. A chip kept mounted would put "Done" in an active card's text.
- Revert flag: `REVERT_FLAG_MS = 1200` in the card, mirroring `--motion-duration-revert`. The card is flagged while `Date.now() - revertedAt < 1200`, with a timeout for the remainder that is cleared on unmount or on a new record. CSS: `outline: var(--revert-flag-width) solid var(--revert-flag-color); outline-offset: var(--revert-flag-offset)`. Under `no-preference`, `outline-color` pulses twice over the duration with `--motion-ease-in-out`. Under reduced motion it is static. Under forced colours it uses `CanvasText`, as do the circle's stroke and the tick.
- Forced colours (DESIGN.md Colors): the circle stroke and the tick use `CanvasText`, and no shadow is shown.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: exit 0 (root and every package, e2e included).
- `pnpm test` -- expected: all unit, component and integration tests pass, the new U3, U4, U5, K2 and K6 tests included.
- `grep -L "resetList" e2e/*.spec.ts` -- expected: no output.
- `pnpm test:all` (caller, holding `/tmp/todo-test-stack.lock`) -- expected: exit 0. e2e passes in all three projects, axe coverage passes, and `coverage/scenarios.md` shows U3, K2 and E2 passing.

**Manual checks (caller):**
- On todo-test with `docker compose -p todo-test --profile test stop api`, a script-driven Chromium ticks a todo that was loaded while the api was up. The check reverts, the banner says it couldn't mark it done with the unavailable reason, and a second toggle and the add field still work. Then take the stack down.

## Auto Run Result

**Status:** built

**Summary:** A todo card now has a Completion check (a native checkbox under a decorative SVG circle and tick, named by the todo text alone) and, when done, the Done chip. A done card recedes in light and dark: it loses its fill and shadow, takes a dashed outline and the done text colour, and the circle fills with a tick. Ticking or unticking goes through AD-13's helper as a follow-up (`setCompleted`) calling `PATCH /api/todos/{id}` with `{ completed }`. The change shows at once and persists. A failed save reverts the card, records `revertedAt`, shows the revert flag for 1.2 s and announces the `complete` or `reopen` lead plus the reason. A 404 announces “{t}” was deleted elsewhere and, if focus was in the row, moves it to the next row's check, else the previous one's, else the list. The row goes on the settle-time refetch. Every e2e spec now empties the list through the public API in `beforeEach` (`resetList`, AD-20).

**Files changed:**
- `apps/web/src/api/client.ts`: `updateTodo` (PATCH, with the existing write timeout).
- `apps/web/src/todos/mutations.ts`: `setCompleted` on the helper.
- `apps/web/src/todos/hooks.ts`: `useSetCompleted` and `useRevertedAt`.
- `apps/web/src/components/TodoCard.tsx`: the check, chip, done class, revert flag and the 404 focus move.
- `apps/web/src/components/TodoCard.module.css`: the check states, done layers (shadow and dashed outline fade by opacity), chip, revert flag pulse, reduced-motion and forced-colours rules.
- `apps/web/src/api/client.test.ts`, `apps/web/src/todos/mutations.test.ts`: U3, U4 and U5 tests for the client and the helper.
- `apps/web/src/components/TodoCard.component.test.tsx` (new): K2 and K6 tests.
- `e2e/helpers.ts`: `resetList`, `createTodo`, `completionCheck` and the complete, reopen and deleted-elsewhere messages.
- `e2e/complete.spec.ts` (new): E2, E6, E7 and E8 for complete and reopen.
- `e2e/todos`, `refresh`, `add-failure`, `offline`, `validation` and `motion.spec.ts`: the `beforeEach` reset.
- `e2e/playwright.config.ts`: the comment on why there is one worker.

**Review:** thorough (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 33 findings: low 28, false 5.
- **Patched (12 entries, all low):**
  - The test server's PATCH body.
  - Layer-opacity checks in e2e.
  - A tap or click e2e test.
  - A forced-colours fill on the circle. While making it, the implementer also fixed a forced-colours stroke rule that lost to the checked state rules.
  - `resetList` confirms the list is empty.
  - The `workers: 1` comment.
  - The id is encoded in `createTodo`.
  - A comment on the unused done-shadow token.
  - Component tests for next-before-previous focus, focus left alone once it has left the row, and a second revert extending the flag.
- **Deferred (1):** the empty-list focus target (the Empty panel), for story 6.
- **Rejected:** each with its reason in the Review Triage Log.
  - A second queued toggle after a 404 re-announces.
  - No guard on `E2E_BASE_URL`.
  - `beforeEach` copies rather than an auto fixture.
  - Real-timer flag tests.
  - The pulse not restarting on a second revert.
  - A mid-window mount cutting the pulse.
  - Focus falling to `<body>` when a failed create removes a row whose queued toggle had focus. This is for the list area's removed-row focus tracking.
  - Production Verify, which happens after merge.
  - R11 restart and new-session checks.
  - A U3 tag.
  - The 5 false findings.

**Follow-up review recommended:** false. Patched this pass: high 0, medium 0, low 12.

**Verification:**
- `pnpm typecheck`: exit 0.
- `pnpm test`: 393 passed.
- `grep -L "resetList" e2e/*.spec.ts`: no output.
- `pnpm test:all`, run twice under `/tmp/todo-test-stack.lock` (before and after the review patches): exit 0 both times, every step passed, todo-test torn down.
  - After the patches, e2e passed 66 tests in desktop, phone and desktop-dark, and axe coverage passed.
  - `coverage/scenarios.md` shows U3 (4), K2 (3), K6 (18), E2 (6), E6 (54), E7 (12) and E8 (45) passing.
- Manual Verify on todo-test, with `docker compose -p todo-test stop api` after the page loaded, in light and dark Chromium:
  - Space on a todo reverted it, focus stayed on the check, and the banner read "Couldn't mark “…” done, so it's still open. The server isn't available right now. Try again in a moment."
  - The other todo's check failed the same way.
  - An add failed with its message, and the text was restored.
  - Both cards stayed listed.
  - The stack was then taken down.

**Residual risks:**
- The production half of the Verify (done in light and dark, after a refresh, reopen) runs only after this merges and deploys.
- The rejected edge cases above.
- The flag component tests use real timers.
- In theory, the checkbox follows the cache one microtask after the click, so one frame could paint the old state.
