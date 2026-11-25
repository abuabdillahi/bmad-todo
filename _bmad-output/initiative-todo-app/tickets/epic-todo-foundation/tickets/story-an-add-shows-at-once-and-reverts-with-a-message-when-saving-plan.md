---
title: 'An add shows at once and reverts with a message when saving fails'
type: feature
ticket: '6'
created: '2026-11-25'
status: built
baseline_revision: '40a461b3904ea749afd6e4e88ae31c8bb55b27de'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `useAddTodo` waits for the server: the card appears only after the `201` and a refetch, a failed add silently keeps its text, and nothing announces "Added". AD-13's optimistic-mutation helper doesn't exist, so epic 2 has nothing to build its writes on.

**Approach:** Build AD-13's helper whole in `apps/web/src/todos/` on story 5's store and announcer, and move the add onto it: the card goes on top of the cache at once (before the first load too), "Added “{t}”." is announced on confirmation, and a failure removes only that card, announces `add` plus the reason, and lets the form restore its text and clear it again if the add landed after all. Add the card's enter motion and the E1/E6/E8 e2e checks, the motion-on spec and the offline spec.

## Boundaries & Constraints

**Always:** AD-7: the client mints `id` with `crypto.randomUUID()` before the mutation starts; the request body and the optimistic todo carry the same cleaned, trimmed description (AD-8). The optimistic todo is `{ id, description, completed: false, createdAt: new Date().toISOString() }` and goes on top. AD-13, all of it: cancel in-flight `['todos']` fetches (await `cancelQueries` before the cache write, so its revert can't undo it), then change that one todo in the cache; per-todo request order (a follow-up for an id waits for that id's earlier calls); pending count in the store, counted from enqueue, left before the settle step, a dropped follow-up leaves when dropped; on failure revert only that todo (never a list snapshot), `store.recordRevert(id, Date.now())`, announce `failure`; a failed create drops its queued follow-ups (not sent, announced or reverted; promise resolves `dropped`); announce `status` on confirmation (`messages.added(t)` for create; `201` and a `200` replay both count); invalidate `['todos']` when the count reaches 0, after failures too; no retries, `networkMode: 'always'`; the per-call promise never rejects and resolves `{ status: 'ok' } | { status: 'failed', failure: FailureInfo } | { status: 'dropped' }`; `revertedAt(id)` readable from the store. Failure wording is `messages.failureMessage('add', failure, text)` (story 5). The add form stays enabled in every list state. EXPERIENCE Add form states (Submitted, Add failed, Add landed after all) and Focus management (Add valid: stays in the cleared field; Add failed: not moved, caret to the end of restored text if the field is focused). Motion never delays state; enter motion is CSS only and instant under reduced motion. Test titles start with their scenario id. No `mutate(vars, { onSuccess, onError })` callbacks.

**Never:** Edit, complete, reopen, delete hooks or UI, the PATCH/DELETE client calls, the revert flag, `deletedElsewhere`, Leaving rows, the empty/loading/error renders or Loading status (epic 2; the helper must support follow-ups only so U5 can test them). Any API, contract, nginx or compose change. A runtime import from `@todo/contract` other than `@todo/contract/description`. Test-only code paths in app code. Mocking hooks in component tests. New design tokens.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Add, loaded | valid text, Enter | card on top at once, field `''`/`0/200`, focus in field; on `201`/`200` "Added “{t}”." (status); one refetch once count is 0 | — |
| Add during Loading / Error | first fetch pending or failed | first fetch cancelled (records nothing); card renders above (list state still `loading`/`error`) | — |
| Add fails, field empty | `503` problem / network / HTML 500 | card removed, others untouched; "Couldn't add “{t}”. " + reason; text restored, caret at end if focused | refetch after settle |
| Add fails, user typed since | field holds newer text | newer text kept, nothing restored | same message |
| Add fails before first load | not loaded | card removed; list state unchanged (never `empty`) | — |
| `400` naming description | server validation problem | reason "Keep it to 1–200 characters." | — |
| Landed after all | failed add's id later in the cache, field still exactly the restored text | field clears to `0/200`, focus not moved, nothing spoken | changed text left alone |
| Two adds, first fails | A pending, B added, A fails | only A's card goes; B stays | — |
| Follow-up queued behind create (U5) | create pending, follow-up on same id | follow-up sent only after create settles; if create fails it is dropped: not sent, announced or reverted, resolves `dropped`, count back to 0, only the add failure announced | — |
| Offline | `context.setOffline(true)` | add fails at once as `network`; a focus refetch fails at once with the network refresh message | — |

</intent-contract>

## Code Map

- `apps/web/src/todos/hooks.ts` -- `useAddTodo()` uses `useMutation` + invalidate and returns `'ok' | 'failed'`. Replace it: return `(description) => Promise<AddOutcome>` where `AddOutcome` is the helper outcome plus the minted `id`. Keep `useListState` (the one `['todos']` observer, used only by `TodoList`), `useTodosStore`, `useAnnouncer`.
- `apps/web/src/todos/store.ts` -- already has `pendingCount`, `mutationStarted`, `mutationSettled`, `recordRevert`, `revertedAt`. Add nothing unless a `revertedAt(id)` reader helps; don't change `selectListState`.
- `apps/web/src/todos/query.ts` -- `todosQueryKey`; the query function already treats an aborted signal as a cancellation (records nothing), and the refetch predicates already gate on `pendingCount === 0`.
- `apps/web/src/todos/TodosProvider.tsx` -- `todosContextFor(queryClient)` builds store, announcer and query options once per client (WeakMap). Create the helper there too and add it to `TodosContextValue`; also the small landed-after-all channel (see Design Notes).
- `apps/web/src/todos/messages.ts` -- `failureMessage('add', failure, text)`, `added(t)`, `FailureInfo`. Unchanged.
- `apps/web/src/api/client.ts` -- `createTodo(body)` (POST; throws `RequestFailure` with `kind`/`namesDescription`), `RequestFailure`, `FailureKind`. Unchanged.
- `apps/web/src/components/AddForm.tsx` -- `submit()` (lines ~207–235): validates, has a `pending` ref guarding duplicate in-flight text, awaits `addTodo`, clears on `ok`. Change: on a valid submit clear the field at once (focus stays in it), then await the outcome; on `failed` restore the sent text only if the field is still `''` (functional `setValue`), caret to end when focused, and remember `{ id, text }` for landed-after-all. The `pending` guard goes (each submit mints its own id). Keep validation, cleaning, Field status, `fieldRef` prop.
- `apps/web/src/components/TodoList.tsx`, `TodoCard.tsx`, `TodoCard.module.css` -- the list area and card. TodoList reports cache ids to the landed-after-all channel and decides which cards play the enter motion; the card gets an enter wrapper (`grid-template-rows` 0fr→1fr, opacity 0→1, `translateY(var(--motion-enter-offset))`→0, `--motion-duration-base`, `--motion-ease-out`, `animation: none` under `prefers-reduced-motion: reduce`). Keep `<ul role="list" aria-label="Todos" tabIndex={-1}>`.
- `apps/web/src/components/Announcer.tsx` -- renders `failure`/`status` variants already.
- `apps/web/test/render.tsx` (`renderApp()`), `apps/web/test/msw.ts` (`server`), `AddForm.component.test.tsx` (`renderAddForm()`, `addFormStatus()`, `NOT_STATUS`), `Announcer.component.test.tsx` -- existing component harness. Tests that change meaning now: "K1 keeps the text and shows no message when the add fails" (now: card gone, message, text restored) and "K1 leaves the list unchanged when the add fails" (now a refetch follows, so `lists` is 2).
- `e2e/todos.spec.ts`, `e2e/refresh.spec.ts`, `e2e/validation.spec.ts`, `e2e/axe.ts`, `e2e/playwright.config.ts` -- three projects, all `reducedMotion: 'reduce'`. `refresh.spec.ts`'s `addTodo` must wait for "Added “…”." before it routes GET, so the settle-time refetch isn't caught by the route.
- `scripts/scenario-coverage.mjs` -- reads leading scenario ids; unchanged.
- Unchanged: `apps/api/**`, `packages/**`, `apps/web/nginx.conf`, `compose.yml`.
- Toolchain: prefix every command with `export PATH=~/.nvm/versions/node/v26.13.1/bin:$PATH`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/todos/mutations.ts` -- `createMutationHelper({ queryClient, store, announce, now? })` with `run(spec)` per AD-13 (see Design Notes for the spec shape), plus `addTodo(description)` built on it (POST via `createTodo`, optimistic todo on top, `added` on success, `failureMessage('add', …)` on failure) -- AD-13, AD-7
- [x] `apps/web/src/todos/mutations.test.ts` -- U4: applied at once (before the send resolves), also onto an undefined cache; rolled back exactly on failure (only that id; another todo changed meanwhile is kept); `recordRevert` called; failure announced with the right reason (problem, network, generic, `validation` naming description); `Added` on `201` and `200`; invalidation once when the count reaches 0, after failure too; promise never rejects. U5: a follow-up `run` on the same id is not sent until the create settles; a failed create drops it (not sent, not announced, cache untouched by it, resolves `dropped`, count 0); a follow-up on another id is not held back -- U4, U5
- [x] `apps/web/src/todos/TodosProvider.tsx`, `hooks.ts` -- create the helper and the landed-after-all channel per client; `useAddTodo()` returns `addTodo` from context; `useLandedAfterAll()` hooks for the list area (report ids) and the add form (subscribe) -- AD-11, AD-13
- [x] `apps/web/src/components/AddForm.tsx` -- optimistic submit, restore-if-empty, caret at end, landed-after-all clear (only when the value is exactly the restored text; no focus move, no Field status) -- EXPERIENCE Add form states
- [x] `apps/web/src/components/TodoList.tsx`, `TodoCard.tsx`, `TodoCard.module.css` -- report cache ids to the channel; enter motion for added cards only (Design Notes) -- AD-11, EXPERIENCE Motion
- [x] `apps/web/src/components/AddForm.component.test.tsx` -- K1: the card is on top before the POST answers (hold the MSW handler on a promise) and the field is cleared with focus in it; "Added “…”." after the answer; a failed add removes the card, keeps the earlier todo, announces `add` + reason, restores the text with caret at end; newer typing is not overwritten; landed-after-all clears exactly-restored text without moving focus or speaking (Announcer text and Field status unchanged) and leaves changed text alone; an add during Loading renders above while the list state stays loading and the first fetch is cancelled (records nothing). Update the two existing failed-add tests -- K1, E6
- [x] `e2e/todos.spec.ts` -- E1's "appears at once": hold POST with `page.route` until the card is visible, then release and see "Added “…”." -- E1, E8
- [x] `e2e/add-failure.spec.ts` -- E6 E8 by keyboard: earlier todo present; POST → 503 with AD-4's body (failing) and POST `route.abort()` (unreachable): the card appears then goes, the banner reads "Couldn't add “…”. " + reason, the text is back in the field with focus there, the earlier todo stays, a later valid add still works; axe in state "add failed" -- E6, E8
- [x] `e2e/motion.spec.ts` -- E1 with `test.use({ reducedMotion: 'no-preference' })`, no axe: an added card runs its enter animation (`getAnimations()` non-empty right after Enter) and ends fully visible -- AD-20 motion-on
- [x] `e2e/offline.spec.ts` -- E6: `context.setOffline(true)`: an add fails within 2 s with the network reason and restores the text; a focus refetch (`visibilitychange`) fails at once with the network refresh message; axe passes -- AD-20 offline
- [x] `e2e/refresh.spec.ts` -- `addTodo` waits for the Added status before routing GET -- story 5 spec stays green

**Acceptance Criteria:**
- Given the test profile, when the user adds a todo by keyboard, then its card is on top before the server answers and "Added “{t}”." shows after, with no axe AA violations in light or dark.
- Given the API failing or unreachable, when the user adds a todo, then its card appears and then goes, the bottom banner says the add failed with the reason, the text is back in the field, and earlier todos stay listed.
- Given `pnpm test:all`, when it runs, then it exits 0 and `coverage/scenarios.md` lists U4, U5, K1, E1, E6 and E8 tests as passing.

## Implementation Notes

- The helper keeps each id's unsettled calls in order (`Entry`: spec, applied, base value, base index). A failure rebuilds the todo from its base by re-running the later pending calls. A failed create removes the todo and drops its follow-ups.
- AddForm drops the old `pending` duplicate guard, because each submit mints its own id. A valid submit clears the field at once. A failed add restores its text only into an empty field, and when it does, it also clears a stale empty-submit error and the Field status.
- The list area reports its ids through a per-client channel, so the add form never observes `['todos']`. Cards that arrive with the first successful load don't animate.
- The space between cards is now a margin under every card but the last, inside the grid row that opens from 0fr. The list no longer uses flex `gap`, so the gap opens with the height instead of jumping. `.body` holds `overflow: clip` through a keyframe, only while the enter animation runs.
- Added the component test "K1 an add during Error renders above while the list stays in error" (matrix audit) and the K1 test for restore after an empty submit (review pass 2).
- `e2e/motion.spec.ts` installs its MutationObserver before pressing Enter, then polls the recorded count. The first version raced and timed out once in desktop-dark.
- Offline e2e runs the focus-refetch check before the add. In the other order, the undismissed add failure would make the announcer drop the refresh message.

## Plan Change Log

### 2026-11-25 — Loopback 1 (review pass 1)
- Trigger: `mutations.ts` `applyToCache` put back the base value it saved at apply time and cleared whatever the cache held for that id. A failed earlier call on an id therefore erased a later pending call's change, and if the later call then failed, its revert brought back the value the server had just refused (v0→v1→v2: call 1 fails → v0 shown while call 2 is pending; call 2 fails → v1). The old Design Notes asked for exactly that capture-and-restore.
- Amended: Design Notes now specify the revert as a rebuild: start from the failed call's base, re-run the later pending calls on that id, and move their bases back, with a required U4 case. They also add `overflow: clip` on the enter wrapper while it animates. Neither is inside `<intent-contract>`.
- Known-bad state avoided: a pending edit or complete disappearing when an earlier call on the same todo fails, and a second failure restoring a refused value. Epic 2 builds edit, complete and delete on this helper.
- KEEP: the rest of the first derivation passed `pnpm test:all` and review, and is saved at `/tmp/story16-keep.patch` (made with `git diff --binary 40a461b3904ea749afd6e4e88ae31c8bb55b27de -- apps e2e`, untracked files included). Apply it first with `git apply /tmp/story16-keep.patch`, then change only what the amended Design Notes and the review findings below require. Keep the following unchanged:
  - the helper's API (`MutationSpec`, `run`, `addTodo`, `MutationOutcome`/`AddOutcome`) and its pending-count, cancel-then-apply, per-id chain, drop and settle logic;
  - the landed-after-all channel (`createLandedChannel`, `useReportRenderedIds`, `useLandedAfterAll`) and AddForm's restore-if-empty;
  - TodoList's enter rule;
  - every test in the patch, including "K1 an add during Error renders above while the list stays in error".

  Also fix these, found in the same review:
  - `e2e/offline.spec.ts`: replace `waitForLoadState('networkidle')` with an explicit wait for the POST response and the GET that follows it, as `refresh.spec.ts`'s `addTodo` does.
  - `apps/web/src/components/AddForm.component.test.tsx`: drop `E6` from the component test titles that start `K1 E6`. E6 is an e2e scenario, and K1 already covers the failed add.

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 1, low 3, false 0, maybe-false 0
- findings:
  - `medium` `bad_plan` `mutations.ts` `applyToCache`: when an earlier call on an id fails, its revert erases a later pending call's change, and the later call's own revert then restores the refused value. Confirmed: the revert filters out the id and inserts the `prev` captured at apply time, whatever the cache holds now. No path in this story reaches it, because a create's follow-ups are dropped, but epic 2's edit and complete will. Amended the Design Notes (rebuild by re-applying later pending calls, plus a U4 case) and looped back with a KEEP patch.
  - `low` `patch` (moot, folded into the loopback) `TodoCard.module.css`: the enter wrapper doesn't clip, so the new card paints at full height over the opening row and the next card covers it for 200 ms. Confirmed: `.body` has `min-height: 0` and no overflow clip. Fix carried into the amended Design Notes: clip only during the animation.
  - `low` `patch` (moot, folded into the loopback) `e2e/offline.spec.ts`: `waitForLoadState('networkidle')` resolves at once, because the page already reached that state after `goto`. The settle-time GET can therefore fail offline and announce the refresh first, and the check passes without the focus refetch. Confirmed against Playwright's documented behaviour (it resolves at once if the state was already reached). Fix carried into the KEEP instructions.
  - `low` `patch` (moot, folded into the loopback) Component titles in `AddForm.component.test.tsx` start `K1 E6`, so `scenarios.md` lists E6 under the component suite, though test-strategy makes E6 an e2e scenario. Confirmed: `scenario-coverage.mjs` takes every leading id. Fix carried into the KEEP instructions: drop E6 from those titles.

### 2026-11-25 — Review pass (after loopback 1)
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0
- findings:
  - `medium` `patch` `AddForm.tsx` restore after a failed add: the restore called `setValue` directly and skipped `update()`, the only place that clears `emptyShown` and the Field status. After "valid text, Enter, Enter again on the now-empty field, the POST fails", the restored valid text kept the "Enter a description." error, `aria-invalid` and the error in `aria-describedby`. Confirmed in `update()` and the restore path. Removing the `pending` guard is what made this reachable. Fixed: the restore also runs `setEmptyShown(false)` and `status.clear()`. A new K1 component test runs that sequence, and it fails without the fix.
  - `low` `patch` `TodoCard.module.css` / `TodoList.module.css`: the list's flex `gap` applied to a new card from its first frame, so the cards below jumped by the gap and only the height eased (EXPERIENCE Motion › Add). Confirmed: `.list` used `gap` and the gap was outside the opening grid row. Fixed: `gap` removed, and each card except the last now has `margin-block-end: var(--todo-list-gap)` inside the row that opens. The resting layout is unchanged, and only row height, opacity and transform animate.

## Design Notes

- Helper spec shape (a guide, not a mandate):
  ```ts
  run({ id, kind: 'create' | 'follow-up',
        apply: (prev: Todo | undefined) => Todo | null,  // null = removed
        position?: 'top', send: () => Promise<unknown>,
        failureText: (f: FailureInfo) => string, successText?: string })
  ```
  Per-id chains: `Map<id, { tail: Promise; createFailed?: boolean; pending: Entry[] }>`; a follow-up whose create failed resolves `dropped`.
- Revert with later calls pending on the same id ("reverts only that todo's change", AD-13): each chain keeps its unsettled calls in order, each with its `apply` and the base value it was applied on (`prev`, plus the index for a todo that existed). When call *i* fails, rebuild that todo from call *i*'s base by re-running the `apply` of every later still-pending call on that id, in order, and write the result into the cache (null removes it). Each later call's base moves back to its predecessor's rebuilt value, so if it fails in turn it never brings back the refused value. With no later pending call this is exactly "put back `prev`". A successful call drops out of the list without touching the cache. U4 must cover: call 1 (v0→v1) and call 2 (v1→v2) pending on one todo; call 1 fails → the cache shows v0 with call 2's change applied, not v0 and not v2; call 2 then fails → v0. A create's failure still drops its follow-ups and removes the todo.
- Enter-motion wrapper: the grid row opens from 0fr, so the card must not paint outside the row while it opens. Clip `.body` (`overflow: clip`) only while the enter animation runs, so cards below never cover the new card and the resting card's shadow is never cut.
- Pending count: `mutationStarted()` at enqueue; on settle call `mutationSettled()` first, then announce/revert, then `invalidateQueries` if the snapshot's count is 0.
- Landed-after-all channel: a tiny per-client emitter in context. `TodoList` calls `report(ids)` in an effect whenever its `todos` change; `AddForm` keeps `restored = { id, text }` and, when its id is reported, clears the field only if `value === text`, then forgets it. AddForm never observes `['todos']` itself (AD-11).
- Enter motion: animate a card on mount only if, in the commit it mounts in, the list is not loaded (only optimistic adds can be there) or the list was already loaded in the previous commit. Cards that arrive with the first successful load don't animate. CSS `@keyframes` on mount, never a JS delay; the DOM and focus change at once.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm exec vitest run --project unit --project component` -- expected: all pass, including U4, U5 and the new K1 cases
- `pnpm test:all` -- expected: exit 0; `coverage/scenarios.md` lists U4, U5, K1, E1, E6, E8 passing in desktop, phone and desktop-dark

## Auto Run Result

**Summary:** Adding a todo now goes through AD-13's optimistic-mutation helper, built whole in `apps/web/src/todos/mutations.ts`.
- Each call cancels in-flight `['todos']` fetches, then puts its one todo into the cache at once (on top for a create, and before the first load too).
- Calls on the same todo are sent in order.
- Every call counts toward the store's pending count from the moment it is queued.
- A failure puts back only that todo: the todo is rebuilt from its value before the call, with the later pending calls on it re-applied. The failure records `revertedAt` and announces `failure` with `add` plus the reason.
- A failed create drops its queued follow-ups. They resolve `dropped` and are never sent, announced or reverted.
- "Added “{t}”." is announced on `201` or a `200` replay.
- `['todos']` is invalidated when the count reaches 0, after failures too.
- Each call's promise never rejects.

In the add form, a valid submit clears the field at once and focus stays in it. A failed add puts its text back only into an empty field, with the caret at the end and any stale empty error cleared. If the failed add's id later appears in the list (it landed after all), the field clears again, but only while it still holds exactly the restored text. The new card plays the Add motion: the row height opens, the card fades in and slides into place, and the cards below shift down. It is instant under reduced motion.

**Files changed:**
- `apps/web/src/todos/mutations.ts`, `mutations.test.ts`: the helper and `addTodo`; U4 (12 cases) and U5 (3 cases)
- `apps/web/src/todos/TodosProvider.tsx`, `hooks.ts`: one helper and one landed-after-all channel per client; `useAddTodo`, `useReportRenderedIds`, `useLandedAfterAll`
- `apps/web/src/components/AddForm.tsx`: the optimistic submit, restore-if-empty, landed-after-all clear
- `apps/web/src/components/TodoList.tsx`, `TodoList.module.css`, `TodoCard.tsx`, `TodoCard.module.css`: the id report, the enter rule, the enter motion, and the space between cards moved inside the opening row
- `apps/web/src/components/AddForm.component.test.tsx`: K1 optimistic-add, failure, restore, landed-after-all, Loading and Error cases; the two old wait-for-server tests removed
- `e2e/todos.spec.ts`: E1's "appears at once", with the create held
- `e2e/add-failure.spec.ts`: E6/E8 add failure with a 503 and with no response
- `e2e/motion.spec.ts`: the motion-on spec
- `e2e/offline.spec.ts`: an offline refetch and add
- `e2e/refresh.spec.ts`: waits for Added and the settle-time refetch before routing GET

**Review findings:**
- Pass 1: 4 findings, 1 medium and 3 low. The medium one went to `bad_plan`: a revert erased a later pending call on the same todo. Loopback 1 amended the Design Notes, and the code was re-derived from a KEEP patch. The 3 lows (no clip during the enter motion, the `networkidle` wait in the offline spec, `E6` tags on component tests) were folded into the loopback and fixed.
- Pass 2: 2 patches applied, 1 medium (a stale empty error on restored text) and 1 low (the gap jumping on add).
- Nothing deferred and nothing rejected.

**Follow-up review recommended:** false. This was a first pass, and the patched entries at their verdicts were 0 high, 1 medium and 1 low; a follow-up needs a high or two mediums.

**Verification:**
- `pnpm typecheck` passes.
- `vitest run --project unit --project component` passes 203 of 203.
- `pnpm test:all` exits 0 with every step passed.
- `coverage/scenarios.md` shows U4 (12), U5 (3), K1 (45), E1 (6), E6 (27) and E8 (21) passing; E1, E6 and E8 pass in desktop, phone and desktop-dark.
- Every I/O matrix row has a passing test.

**Residual risks:**
- The rebuild revert for several pending calls on one todo has unit tests only (U4). No path in this story reaches it; epic 2's edit, complete and delete will be its first real callers.
- The clip during the enter motion is a keyframe on `overflow`, checked in Chromium only. Another engine might play the motion without the clip.
- The gap moving inside the row was checked by the implementer in Chromium, and by the e2e suite only through axe and behaviour. Nobody inspected the motion by eye.
- Nobody ran the story's manual Verify (stopping the api container) or used a screen reader. The e2e tests inject failures with `page.route` and `setOffline`.
