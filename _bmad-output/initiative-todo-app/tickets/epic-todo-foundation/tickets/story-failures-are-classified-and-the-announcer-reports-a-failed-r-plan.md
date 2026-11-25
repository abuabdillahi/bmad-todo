---
title: 'Failures are classified, and the announcer reports a failed refresh'
type: feature
ticket: '5'
created: '2026-11-25'
status: built
baseline_revision: '197cbf35fc50dd07cb90167576bd9c26dbaffcfb'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The web client turns every failure into a bare `ApiError(status)`. Nothing records whether the list has loaded or why the last fetch failed, so a failed background refetch is silent. No announcer, `FailureKind`, failure wording or list-state selector exists, and story 6's mutation helper and epic 2's list states need all of them.

**Approach:** Classify every failure as one `FailureKind` in the API client (AD-9). Build AD-11's todos store, query function, list-state selector and query policy whole, and AD-14's announcer (store, `announce(kind, text)`, replacement rules, the visible region with Dismiss). Add the leads, reasons, overrides, status messages and `{t}` quoting to `messages.ts`. Once the list is loaded, a failed fetch keeps the list and announces `refresh` plus its reason.

## Boundaries & Constraints

**Always:** AD-9: the kinds are `validation | not-found | conflict | unavailable | internal | network | generic`. A problem is classified by `type` only when the media type is `application/problem+json` (prefix and case-insensitive match, because the API appends `; charset=utf-8` and nginx doesn't). Any other non-2xx, or an unknown `type`, is `generic`. A rejected `fetch` is `network` unless the caller's signal aborted it, which is a cancellation and never a failure. AD-11: one todos store per `QueryClient`, read with `useSyncExternalStore`. The query function records outcomes: on success `setQueryData` first, then loaded, then clear the failure and the retry. It records nothing when its signal aborted, checked after the last `await` too. Policy: `retry: false`, `networkMode: 'always'`, and `refetchOnMount`/`WindowFocus`/`Reconnect` each a predicate true only when the pending count is 0. AD-14 and EXPERIENCE › Announcer: one region, first in `<main>`. Its live element (`role="status"`, `aria-live="polite"`) is always mounted, never `display:none`/`hidden`/`visibility:hidden` on it or any ancestor, never `aria-hidden` or `inert` on an ancestor, and wraps only the text. The icon is `aria-hidden`. Dismiss sits outside the live element. Wording is EXPERIENCE Voice and Tone, verbatim. Dismiss focus goes to the add field, or to the heading with `{ preventScroll: true }` after a touch or pen `pointerdown`, before the message clears (hand-off order). Motion uses the tokens and is instant under `prefers-reduced-motion: reduce`. Test titles start with their scenario id. Icons are inline in JSX.

**Never:** The mutation helper, optimistic add, add-failure message, "Added", restoring text or landed-after-all (story 6). Rendering the empty, loading or error states, the Loading status, Try again UI or `deletedElsewhere` detection (epic 2; the store and selector support them). Any API, contract or nginx change. A runtime import from `@todo/contract` other than `@todo/contract/description` (use `import type`). Test-only code paths in app code. Mocking hooks in component tests. New design tokens.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Problem | 4xx/5xx `application/problem+json; charset=utf-8`, known `type` | kind = type name; `namesDescription` true only for `validation` whose `errors` has `field: 'description'` | — |
| Generic | HTML 502, non-problem JSON, unknown `type`, bad JSON | `generic` | — |
| Network | `fetch` rejects, signal not aborted | `network` | — |
| Cancellation | signal aborted before or after the response | records nothing, announces nothing | rethrown, never classified |
| First load fails | not loaded, fetch fails | `lastFetchFailure` = kind, no announcement, selector `error` | — |
| Refresh fails | loaded, fetch fails (focus refetch) | list kept; announcer: "Couldn't refresh the list. You're seeing what was last loaded." + " " + reason | `validation`/`conflict`/`internal`/`generic` → generic reason |
| Same refresh again | identical `refresh` still showing | left as it is, not re-set | — |
| Refresh vs failure | undismissed `failure` showing | `refresh` dropped, not queued | — |
| Repeat message | identical non-refresh text | live text cleared, set again next frame; banner stays | — |
| Dismiss | Enter/Space/click on Dismiss | focus on add field (heading after touch/pen); live text empty; chrome fades out | — |
| Recovered | a later fetch succeeds | loaded; failure and retry cleared; message stays until dismissed or replaced | — |

</intent-contract>

## Code Map

- `apps/web/src/api/client.ts` -- `request<T>()` throws `ApiError(status)` on any non-2xx and lets a `fetch` rejection escape. `listTodos(signal)`, `createTodo(body)`. It's the only HTTP code. Replace `ApiError` (only `client.ts` uses it).
- `apps/web/src/todos/hooks.ts` -- `todosQueryKey`, `useTodos()` (bare `useQuery`, no store), `useAddTodo()` (waits for the server; story 6 replaces it, so keep its behaviour and outcome type).
- `apps/web/src/todos/messages.ts` -- `messages.inline` (story 4), imported by `AddForm.tsx`. Extend it and keep `inline` unchanged.
- `apps/web/src/main.tsx` -- builds `QueryClient` (`retry: false`, `networkMode: 'always'` for queries and mutations) and renders `<QueryClientProvider><App/>`.
- `apps/web/src/components/App.tsx` -- `<main>` with `<h1 tabIndex={-1}>`, `<AddForm/>`, `<TodoList/>`. `App.module.css` `.page` already pads the bottom by `var(--announcer-block-size, 0px)`.
- `apps/web/src/components/AddForm.tsx` -- internal `fieldRef` on the textarea (`useId` ids, no stable id). Expose it with a `fieldRef` prop or forwarded ref, unchanged otherwise.
- `apps/web/src/components/TodoList.tsx` -- the one observer of `['todos']`. It renders the `<ul role="list" aria-label="Todos" tabIndex={-1}>`; keep that markup.
- `apps/web/src/styles/tokens.css` -- already has `--announcer-*`, `--announcer-status-*`, `--dismiss-button-*`, `--dismiss-button-status-*`, `--font-announcer-*`, `--motion-duration-fast`, `--motion-ease-out`, `--motion-enter-offset`, `--motion-press-scale`, light and dark. `global.css` has `.visually-hidden`. See DESIGN.md Components › Announcer / Dismiss button and Layout & Spacing (phone: inset 16px, text stacked above a right-aligned Dismiss; ≥768px: centred, max 720px, Dismiss inline right; forced colours: 1px `CanvasText` border).
- `apps/web/src/components/AddForm.component.test.tsx` -- `renderAddForm()` wraps in a bare `QueryClientProvider`, and some tests render `TodoList` too. Switch to the shared provider; leave the assertions alone.
- `apps/web/test/{msw,setup}.ts` -- MSW `server`, `onUnhandledFrame: 'error'`.
- `e2e/{todos,validation}.spec.ts`, `e2e/axe.ts`, `e2e/playwright.config.ts` -- three projects (desktop, phone = Pixel 7 with touch, desktop-dark), `reducedMotion: 'reduce'`, `expectNoAxeViolations(page, state)`, unique descriptions.
- `vitest.config.ts` -- `unit` (node) picks up `apps/*/src/**/*.test.ts(x)`; `component` (jsdom) picks up `*.component.test.tsx`.
- Unchanged: `apps/api/**`, `packages/**`, `nginx.conf`, `compose.yml`, `scripts/**`.
- Toolchain: prefix every command with `export PATH=~/.nvm/versions/node/v26.13.1/bin:$PATH`. `@tanstack/react-query` 5.108.4.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/api/client.ts` -- export `FailureKind`, `class RequestFailure extends Error { kind; namesDescription }`, and `isCancellation(error, signal)`. `request` classifies per the matrix, and the problem type names are checked against `ProblemType` with `import type` + `satisfies`. Unit test `client.test.ts` with a stubbed global `fetch` covers every matrix row (problem with and without a charset, every type, unknown type, HTML, bad JSON, rejection, abort) -- AD-9
- [x] `apps/web/src/todos/messages.ts` -- `quote(text)` (curly quotes; over 40 code points → cut at 40, trailing whitespace trimmed, "…" inside the closing quote); `lead` per action (`add`, `edit`, `complete`, `reopen`, `delete` take text; `refresh`, `load` are strings); `reason` per `FailureKind`; `failureMessage(action, failure)` (`validation` reason only for `add`/`edit` with `namesDescription`, else generic; `conflict` → generic); `deletedElsewhere(t)`, `added(t)`, `deleted(t)`, `loadError(kind)`, `dismiss: 'Dismiss'`. `messages.test.ts` checks every lead × reason composition rule and the quote cut (emoji counted as one) -- AD-14, Voice and Tone
- [x] `apps/web/src/todos/announcer.ts` -- `createAnnouncer({ nextFrame })`: an external store with snapshot `{ message: { kind, text } | null, spoken: string }`, plus `announce(kind, text)` and `dismiss()` per the matrix's replacement rules (a `status` replaces a failure; a repeat clears `spoken` and sets it on `nextFrame`, cancelling any pending frame on a newer call or dismiss). `announcer.test.ts` (K7) covers each rule -- AD-14
- [x] `apps/web/src/todos/store.ts` -- `createTodosStore()`: an immutable snapshot `{ loaded, lastFetchFailure, retryRequested, pendingCount, revertedAt: ReadonlyMap }`, `subscribe`/`getSnapshot`, `recordFetchSuccess`, `recordFetchFailure(kind)`, `requestRetry`, `mutationStarted`/`mutationSettled`, `recordRevert(id, at)`. A pure `selectListState(snapshot, cached: Todo[] | undefined)` returns `'loading' | 'error' | 'populated' | 'empty'` per AD-11. `store.test.ts` covers the selector table and the record rules -- AD-11
- [x] `apps/web/src/todos/query.ts` -- `createTodosQueryFn({ queryClient, store, announce })` per AD-11 (cancellation, success ordering, failure records the kind, clears the retry, and announces `refresh` with `failureMessage('refresh', …)` only once loaded; rethrows). `todosQueryOptions(...)` holds the key, the function and the predicates -- AD-11
- [x] `apps/web/src/todos/TodosProvider.tsx` -- `createQueryClient()` (moved from `main.tsx`) and `<TodosProvider queryClient? children>`, which creates the store, the announcer and the query options once and provides them through context beside `QueryClientProvider`. `hooks.ts`: `useTodosStore()` (snapshot), `useListState()` → `{ state, todos }` (the one `useQuery` observer, used only by `TodoList`), `useRetryFetch()` (`requestRetry`, then `refetchQueries` only when the count is 0), `useAnnouncer()` / `useAnnouncement()`. `useTodos` is removed; `useAddTodo` is unchanged -- AD-11, AD-14
- [x] `apps/web/src/main.tsx`, `App.tsx`, `TodoList.tsx`, `AddForm.tsx` -- render through `TodosProvider`. App owns the heading and add-field refs and renders `<Announcer focusTargets>` first in `<main>`. `TodoList` reads `useListState().todos` -- AD-11
- [x] `apps/web/src/components/Announcer.tsx`, `Announcer.module.css`, `styles/global.css` -- the region per DESIGN.md and EXPERIENCE: failure and status variants, the empty state with no chrome and `pointer-events: none`, and the Dismiss button (track the last `pointerdown`'s `pointerType`; focus first, then `dismiss()`). The enter animation runs only when going from empty to shown. On Dismiss, an `aria-hidden` copy of the text and button (spans, not focusable) fades out for `--motion-duration-fast` (0 under reduced motion, via `matchMedia`), with the live element already empty. While shown, a `ResizeObserver` (feature-checked) sets `--announcer-block-size` on `<html>` to height + bottom offset + 8px, and sets `0px` once cleared. `html { scroll-padding-bottom: var(--announcer-block-size, 0px) }` -- AD-14
- [x] `apps/web/src/components/Announcer.component.test.tsx`, `apps/web/test/render.tsx` -- a shared `renderApp()` helper (real `TodosProvider` + `App`, MSW). K7: loaded list, then a focus refetch (`focusManager.setFocused`) answers a 503 problem: the list stays and the live element has the refresh lead plus the unavailable reason; a `network` (`HttpResponse.error()`) and an HTML 502 give their reasons; a first-load failure announces nothing; an aborted fetch records nothing; the same failure again is not re-set (observe with a MutationObserver); an undismissed `failure` (via `useAnnouncer` from a test-rendered child) is not replaced by `refresh`; a recovery keeps the message. K6: Dismiss has the name "Dismiss", is reachable by Tab, clears on Enter and on click with focus in the add field and never on `<body>`, and goes to the heading after a touch `pointerdown`. Update `AddForm.component.test.tsx` to use the helper -- K6, K7
- [x] `e2e/refresh.spec.ts` -- E6 E8 by keyboard: add a todo, `page.route` GET `/api/todos` → 503 with AD-4's literal body, then trigger a focus refetch by dispatching `visibilitychange`. The todo stays, the status reads the refresh message with the unavailable reason, and axe passes in state "refresh failed". Tab reaches Dismiss first, Enter clears it, focus is in the add field. A second test uses `route.abort()` (network reason) and dismisses by click (desktop) or `tap` (phone → heading focused) -- E6, E8, story Verify

**Acceptance Criteria:**
- Given the test profile with a todo listed, when GET `/api/todos` starts failing and the tab regains focus, then the todo stays listed and the bottom banner reads "Couldn't refresh the list. You're seeing what was last loaded." followed by the reason for that failure, with no axe AA violations in light or dark.
- Given the refresh banner, when the user dismisses it by keyboard or mouse, then it clears and focus lands on the add field (the heading after a touch).
- Given `pnpm test:all`, when it runs, then it exits 0 and `coverage/scenarios.md` lists K6, K7, E6 and E8 tests as passing.

## Implementation Notes

- Added `apps/web/src/todos/query.test.ts` (not asked for): cache-before-loaded ordering, the abort check after the last `await`, and the three refetch predicates.
- `TodosProvider` keeps the store, announcer and query options in a `WeakMap` keyed by `QueryClient`, so there is exactly one of each per client.
- `AddForm` exposes its textarea through a `fieldRef` prop (`useImperativeHandle`). App owns the heading and add-field refs that the Announcer's Dismiss focuses.
- `AddForm.component.test.tsx` adds a default empty GET handler in `beforeEach`, because the list now loads on mount. Its Field-status query is scoped to the form, since the Announcer adds a second `role="status"`.
- e2e tab order: Chromium keeps its sequential-focus start point after `blur()`, so the spec presses Shift+Tab from the add field and asserts Dismiss is the first tabbable element on the page.
- The unit tests for the announcer, store, query, messages and client carry the K7 prefix.

## Plan Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 4 findings — high 0, medium 0, low 2, false 2, maybe-false 0
- findings:
  - `low` `patch` The K1 "add fails" test changed its assertion to `getAllByRole('status')` equals `['', '']`, which ties it to the Announcer's live-region count, against the Code Map's "leave the assertions alone". Fixed: it asserts `addFormStatus().textContent` is `''` again.
  - `low` `patch` `.shown .message` gave the status variant the icon-alignment top padding, which DESIGN.md applies to the failure variant only, so "Added"/"Deleted" banners would get 4px of uneven padding. Fixed: `padding-top` moved to `.failure .message`.
  - `false` `reject` `messages.reason` has its own `conflict` key, though EXPERIENCE says conflict "has no key of its own and maps to the generic reason". The value is the generic string, so every message that maps `conflict` is the generic reason (proven by `messages.test.ts` for every action and for refresh). No caller can get a different wording.
  - `false` `reject` `--announcer-block-size` is not reset when the Announcer unmounts. The Announcer is app-level and never unmounts in the app. In tests, each mount's layout effect runs with `shown` false and sets `0px` before any assertion, so a leaked value never reaches a test. The jsdom 150 ms fade fallback is harmless: the tests assert the live element and focus, not the ghost copy's lifetime.

## Design Notes

- Query function shape (golden example):
  ```ts
  async ({ signal }) => {
    try {
      const list = await listTodos(signal);
      if (signal.aborted) throw signal.reason;
      queryClient.setQueryData(todosQueryKey, list); store.recordFetchSuccess(); return list;
    } catch (error) {
      if (isCancellation(error, signal)) throw error;
      const kind = error instanceof RequestFailure ? error.kind : 'generic';
      const wasLoaded = store.getSnapshot().loaded; store.recordFetchFailure(kind);
      if (wasLoaded) announce('refresh', messages.failureMessage('refresh', ...)); throw error;
    }
  }
  ```
- TanStack v5's `focusManager` listens only to `visibilitychange`, so dispatching it while the page is visible triggers a focus refetch. Check that e2e and component tests trigger it this way.
- The web must not import `@todo/contract` at runtime, because its index pulls in TypeBox. The kind names are local literals checked against `ProblemType` at compile time.
- The banner's chrome keys off `message !== null`, and the live element's text is `spoken`, so a repeat clears and re-sets the text without moving the banner.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm exec vitest run --project unit --project component` -- expected: all pass, including the K6 and K7 cases and the existing K1 tests
- `pnpm test:all` -- expected: exit 0; `coverage/scenarios.md` lists K6, K7, E6, E8 passing in desktop, phone and desktop-dark

## Auto Run Result

**Summary:** Every web request failure is now classified as one AD-9 `FailureKind`: the problem's type name (only under `application/problem+json`, with or without a charset), `network` (a rejected fetch the caller did not abort), or `generic`. A cancellation is never a failure. AD-11 is built whole:
- one todos store per `QueryClient` (loaded, last fetch failure, retry requested, pending-mutation count, revert records);
- the query function, the only place fetch outcomes are recorded (cache written before loaded; cancellations record nothing, checked after the last `await`);
- the list-state selector;
- the query policy (no retries, `networkMode: 'always'`, mount/focus/reconnect refetch only while no mutation is pending) and `useRetryFetch`.

AD-14's announcer is built:
- an external store with `announce(kind, text)` and the replacement rules (a refresh is dropped under an undismissed failure; an identical refresh still showing is left alone; a repeat is cleared and re-set on the next frame);
- the visible bottom region, first in `<main>`, with failure and status variants, an always-mounted live element that wraps only the text, and Dismiss (focus goes to the add field first, or to the heading with `preventScroll` after touch or pen);
- `--announcer-block-size` and the root `scroll-padding-bottom`;
- enter and fade-out motion that is instant under reduced motion.

`messages.ts` has every lead, reason, override and status message, the List error panel line and `{t}` quoting. Once the list is loaded, a failed background fetch keeps the list and announces `refresh` plus its reason.

**Files changed:**
- `apps/web/src/api/client.ts`: `FailureKind`, `RequestFailure`, `isCancellation`, classification (replaces `ApiError`)
- `apps/web/src/api/client.test.ts`: the classification matrix with a stubbed `fetch`
- `apps/web/src/todos/messages.ts`, `messages.test.ts`: leads, reasons, overrides, status messages, `quote`, `failureMessage`, `loadError`
- `apps/web/src/todos/announcer.ts`, `announcer.test.ts`: the announcer store and its replacement rules
- `apps/web/src/todos/store.ts`, `store.test.ts`: the todos store and `selectListState`
- `apps/web/src/todos/query.ts`, `query.test.ts`: the query function and query policy
- `apps/web/src/todos/TodosProvider.tsx`: `createQueryClient`, and one store, announcer and query per client, through context
- `apps/web/src/todos/hooks.ts`: `useTodosStore`, `useListState`, `useRetryFetch`, `useAnnouncer`, `useAnnouncement` (`useTodos` removed)
- `apps/web/src/components/Announcer.tsx`, `Announcer.module.css`: the Announcer region and the Dismiss button
- `apps/web/src/components/Announcer.component.test.tsx`: K7 refresh cases, K6 Dismiss cases
- `apps/web/src/components/{App,AddForm,TodoList}.tsx`, `apps/web/src/main.tsx`: provider, refs, Announcer placement, selector
- `apps/web/src/styles/global.css`: `scroll-padding-bottom`
- `apps/web/src/components/AddForm.component.test.tsx`, `apps/web/test/render.tsx`: the shared `renderApp()` helper
- `e2e/refresh.spec.ts`: E6/E8 refresh failure (503 and no response), keyboard, click and tap Dismiss, axe

**Review findings:** 2 patches applied, both low: the K1 assertion restored to the form's own status, and the status variant no longer gets the icon top padding. None deferred. 2 rejected as false: the explicit `conflict` key, whose value is the generic reason so no wording differs; and the block-size property not reset on unmount, which every mount resets to `0px`.

**Follow-up review recommended:** false (patched: high 0, medium 0, low 2).

**Verification:**
- `pnpm typecheck` passes.
- `vitest run --project unit --project component` passes 180 of 180.
- `pnpm test:all` exits 0 with every step passed, after the patches too.
- `coverage/scenarios.md` shows K6 (8), K7 (117, unit and component), and E6 (18) and E8 (15) passing in desktop, phone and desktop-dark.
- Every I/O matrix row has a passing test.

**Residual risks:**
- The banner's phone and wide layouts and the fade-out were not inspected by eye. Only axe and the behaviour assertions cover them.
- The e2e refetch is triggered by dispatching `visibilitychange`, not by a real tab switch. The story's manual Verify (stop the api container, switch tabs) was not run by hand.
- No screen reader was used, so the spoken output was not checked by ear.
