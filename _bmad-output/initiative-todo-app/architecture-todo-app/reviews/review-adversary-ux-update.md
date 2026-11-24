---
type: architecture-review
lens: adversary
target: _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md
scope: 'UX-flag amendments: AD-4, AD-6 (health), AD-8, AD-9, AD-11, AD-13, AD-14, AD-20, Deferred (failed create)'
reviewed: '2026-11-24'
inputs: [architecture-todo-app.md, .memlog.md (UX-flag entries), ux-todo-app/EXPERIENCE.md]
verdict: 'Not yet safe to build the web data layer from. 6 major holes, 5 minor ones, all in the client state machinery the amendments added'
---

# Adversarial review: UX-flag amendments to the Todo App v1 spine

**Lens.** Build two units one level down (the todos hooks and query policy, the mutation helper, the announcer, list and row components, the API client, nginx, the contract/API validation, the e2e harness). Each unit follows every AD to the letter, and the pair still builds incompatibly. Each pair is a hole, and each comes with the smallest AD tightening that closes it. Deliberate deferrals (the duplicate after a network-failed create, access control, and the rest of Deferred) and the `{id}` path tokens are not flagged.

**Verdict: needs one more tightening pass on AD-11, AD-13 and AD-14 before the web stories are refined.** The amendments fix the right problems. Flags 1, 5, 6, 7, 9 and 10 are closed in substance. But the new state the spine introduces (the **loaded** and **last fetch failed** facts, the fetch gate, `revertedAt`, the leaving row, the follow-up queue) is specified by *what* it means, not by *where it lives* or *which event writes it*. In TanStack Query v5, several of the obvious, AD-compliant ways to write it break each other. Most of the holes sit where `cancelQueries`, `setQueryData`, `invalidateQueries`, manual `refetch()` and `networkMode` do something the prose doesn't expect.

Severity: **Major** means two compliant units produce a wrong visible state, a lost or false announcement, or a stuck list at runtime. **Minor** means drift, a misleading message in a rare case, or rework, with no break.

---

## Major

### M1. A fetch cancelled by the helper is recorded as a failure (or as a success)

- **Unit A (todos hooks):** AD-11 says the hooks record **loaded** and **last fetch failed** "from the query function". So the query function wraps the API client in `try`/`catch`. On success it sets loaded. On any rejection it sets last-fetch-failed, and if loaded is set it calls `announce('refresh', …)`. It passes the query's `signal` to `fetch`, as TanStack recommends.
- **Unit B (mutation helper):** AD-13 says to cancel in-flight `['todos']` fetches first, so it calls `cancelQueries({ queryKey: ['todos'] })`.
- **Unit C (API client):** AD-9 says **`network`** means "`fetch` rejects (no response arrived)". An `AbortError` is a rejection with no response, so it is classified `network`.
- **What breaks:**
  - *Add during Loading* (the case flag 4 was about): the add cancels the first load. The query function sees a `network` rejection and records last-fetch-failed. The list flips from skeletons to the List error panel ("Couldn't load your todos. Check your connection…"), and the hidden loading status speaks it, although nothing failed. AD-11 then forbids any fetch until the add settles.
  - *Once loaded:* a focus or reconnect refetch is in flight and the user ticks a checkbox. The cancel becomes "Couldn't refresh the list. Check your connection…", which replaces an "Added" status message. This happens on any mutation started during a refetch.
  - *If Unit A does **not** pass the signal:* TanStack rejects the cancelled fetch with its own `CancelledError` and discards the result. The wrapper's `fetch` still resolves, though, so the wrapper records **loaded** for data that never reached the cache. If the add then fails and the settle refetch fails, the list shows a false "No todos yet.", which is the exact hole flag 4 closed.
- **Both comply because** AD-11 places the recording in the query function body, AD-9 has no category for a cancellation, and AD-13 makes cancellation routine.
- **Proposed AD fix (AD-11, AD-9):** "The facts are recorded when a fetch's outcome is **committed** to the query, not inside the query function. One `QueryCache` subscriber does this: a fetch `success` action (not a `setQueryData` write) sets loaded and clears failed, and an `error` action sets failed. A fetch cancelled by `cancelQueries` records nothing and announces nothing. The API client passes the query's `AbortSignal` to `fetch`, and a rejection whose signal is aborted is a cancellation, not `network`." (In v5, `setQueryData` dispatches a success action flagged `manual`, and a reverted cancel dispatches no `error`. Verify both against 5.108 when this is written.)

### M2. "No fetch starts while a todo mutation is pending" has no single enforcement point, and three triggers bypass it

- **Unit A (hooks, query options):** following the memlog ("predicate form of the options"), it sets `refetchOnWindowFocus` and `refetchOnReconnect` to `(q) => queryClient.isMutating({ mutationKey: ['todos'] }) === 0`. Everything else stays at defaults (`staleTime: 0`, `refetchOnMount: true`).
- **Unit B (list components):** AD-11 lets components read through the hooks, so the Todo list, the Empty panel and the skeleton list each call `useTodos()`. The list area swaps between them, so an optimistic add on an empty list unmounts the Empty panel and mounts the Todo list. The new observer's `refetchOnMount` starts a `GET` while the `POST` is pending. If the `GET` lands first, the optimistic card vanishes and then comes back on settle, which is the very race AD-11 exists to prevent.
- **Unit C (Try again):** calls the hook's `refetch()`. Option predicates do not gate manual `refetch()`, so the fetch starts mid-mutation.
- **Unit D (helper, settle):** AD-13: "invalidates `['todos']` when no todo mutation is still pending". It checks `isMutating(...) === 0` in `onSettled`. In v5 a mutation is still counted as pending while its own `onSettled` runs (the status changes after the callbacks), so the count is never 0 there, and the settle invalidation never runs. Alternatively, if Unit A gates with `enabled: isMutating === 0`, the invalidation finds no active observer to refetch.
- **Also undefined:** whether a follow-up queued behind a pending `POST`, or one dropped after a failed create, counts as "pending".
- **Both comply because** AD-11 names the triggers ("focus, reconnect, Try again or invalidation"), but not mount, and not the mechanism, and AD-13 doesn't define "pending".
- **Proposed AD fix (AD-11, AD-13):** "The helper owns one count of todo mutations, sent or queued. A mutation leaves the count *before* the helper's settle check, and a dropped follow-up leaves it when it is dropped. Every `['todos']` fetch trigger checks that one count: `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` use it as their predicate, Try again calls a hook function that refetches only when the count is 0, and the helper's settle step invalidates when the count reaches 0. Exactly one component, the list area, observes `['todos']`."

### M3. TanStack's default `networkMode: 'online'` turns real offline failures into indefinite pauses

- **Unit A (hooks and helper):** AD-11 sets `retry: false` and AD-13 "retries nothing". `networkMode` is left at its default, `'online'`.
- **Unit B (e2e, AD-20):** "unreachable" is injected with `page.route(...).abort()`, which leaves the browser online. So E-specs see an immediate `network` failure and pass.
- **What breaks in a real browser:** once the browser fires `offline`, v5 *pauses* queries and mutations instead of running them.
  - A tick or an add made offline stays pending. Nothing fails, nothing reverts, and nothing is announced. The UX's network reason ("Check your connection and try again.") and the flag 7 path never happen.
  - Because the mutation stays pending, M2's gate blocks every fetch until the browser is back online.
  - A first load attempted offline pauses without calling the query function. So it is neither loaded nor failed, and the skeletons with "Loading your todos" stay up instead of the List error panel.
  - On reconnect, every paused mutation fires at once. This is the automatic retry that AD-13 forbids, and it can run minutes after the user saw the optimistic result.
- **Both comply because** no AD mentions `networkMode`, and the AD-20 injection can't observe the difference.
- **Proposed AD fix (AD-11, AD-13, AD-20):** "The `['todos']` query and every todo mutation use `networkMode: 'always'`, so an offline request fails at once as `network`. Refetch on reconnect stays on. One e2e spec uses `context.setOffline(true)`, in addition to `abort`."

### M4. "Hook state" has no single owner: loaded, last fetch failed and `revertedAt` can live in one component's instance

- **Unit A (helper):** keeps the revert record with `useState` inside `useTodoMutations()`, which each card calls, as AD-13's "hook state" allows. It records the facts in a `useRef` in `useTodos()`.
- **Unit B (row and list components):** a card re-mounted after a failed delete calls `revertedAt(id)` on its *new* hook instance and gets nothing. AD-13 names this exact case as the reason `revertedAt` exists. A list sub-component that mounts later (M2's Todo list after the Empty panel) starts with loaded = false and renders skeletons over a loaded list.
- **Component tests** need the opposite of a plain module singleton: a module-level store leaks loaded = true from one test file into the next test's fresh `QueryClient`.
- **Both comply because** AD-11 and AD-13 say "the hooks record" and "hook state", which a React-hook author reads as per-instance state.
- **Proposed AD fix (AD-11, AD-13):** "The loaded and last-fetch-failed facts, the pending count (M2) and the revert record live in **one store per `QueryClient`**, created with it (for example, provided by the same provider). Hooks read it with `useSyncExternalStore`. No hook instance holds its own copy."

### M5. Try again: AD-11's list-state rule and the UX's "panel replaced by skeletons at once" give list state two owners

- **Unit A (hooks):** AD-11, literally: while not loaded, the list is in its error state if the last fetch failed. Pressing Try again doesn't change that fact until the new fetch fails or succeeds. During a pending add (UX row "Add during Error"), AD-11 defers the fetch to the settle invalidation, so the Error panel stays up for the whole mutation.
- **Unit B (List error panel component):** EXPERIENCE.md, binding on the UI: "The panel is replaced by skeletons at once." To get that, the component keeps a local `retrying` flag, which is a second copy of list state that AD-11 forbids. That flag then has to guess when to clear itself, including when the fetch never starts.
- **Related, in AD-14:** the hidden loading status speaks "only the first load's progress and its failure". Unit C reads "first load" as the first fetch only, so a failed Try again is silent: the panel comes back, focus is on the add field, and nothing is spoken. Unit D reads it as any fetch while not loaded.
- **Both comply because** AD-11 defines the error state only from the *last outcome*, not from a fetch that has been requested or is in flight.
- **Proposed AD fix (AD-11, AD-14):** "While not loaded, the list is in its loading state while a `['todos']` fetch is in flight **or requested and deferred** (Try again during a pending mutation), and in its error state only when the last fetch failed and none is in flight or requested. The store from M4 holds the requested flag, and the next committed outcome clears it. 'First load' in AD-14 means any fetch while not loaded."

### M6. A delete that fails during its exit motion yields two rows for one todo

- **Unit A (list component):** uses AD-11's exception, keeping a `leaving` map of user-deleted todos rendered `inert`/`aria-hidden`, merged with the cache rows by id, until a `{motion.duration-base}` timer unmounts each one.
- **Unit B (helper):** on a failed delete, puts the todo back in the cache at its old position and sets `revertedAt(id)` (AD-13). When the user is offline or `abort` is injected, this happens within milliseconds, well inside the exit timer.
- **What breaks:** the id is now both in the cache and in `leaving`.
  - Either React sees duplicate keys (two rows, one hidden from assistive tech, with the restored row possibly reconciled onto the inert element),
  - or Unit A's merge keeps the leaving copy, the timer then unmounts it, and a todo that is in the cache isn't rendered at all.
  - EXPERIENCE.md requires that the restored row is "mounted fresh, without `inert` or `aria-hidden`".
- **Both comply because** AD-11 allows the leaving copy "for its exit motion only" but says nothing about the todo coming back during that motion, and AD-13 now promises a revert that can land inside it.
- **Proposed AD fix (AD-11):** "If a leaving row's id reappears in the cache, the leaving copy unmounts at once, and the cached row mounts as a new element (its key changes with `revertedAt(id)`)."

---

## Minor

### m1. "The helper owns every announcement" contradicts a component-detected message, whose kind is not fixed

- **Unit A (helper):** AD-13 says the helper, not a component, owns every announcement.
- **Unit B (edit row):** EXPERIENCE.md's row "Edit open, todo vanishes on refetch" needs "“{t}” was deleted elsewhere" announced. Only the component knows the row is in edit mode, and the layer table lets components depend on the announcer. So the row calls `announce('status', …)` from its unmount cleanup. As a `status` message, it overwrites an undismissed failure. If another author picks `refresh`, it is dropped silently.
- **Proposed AD fix (AD-13, AD-14):** "Components call `announce` for exactly one case: a todo that disappears while its row is in edit mode. The list area, which stays mounted, calls it with kind `failure`." Alternatively, remove the components → announcer edge from the layer table and have the edit row register its id with the hooks.

### m2. The source of the `refresh` announcement is unfixed, so it can be spoken once per observer

- **Unit A:** announces `refresh` from a `useEffect` on `query.error` inside `useTodos()`. With several observers (M2), every observer fires the effect. EXPERIENCE.md re-speaks an identical repeated message, so the screen reader says it two or three times.
- **Unit B:** announces it from the query function, once per fetch.
- **Proposed AD fix (AD-11):** "The refresh-failure announcement is made once per failed fetch, by the same subscriber that records the outcome (M1), never by a component or a per-observer effect."

### m3. The control-character rule is written twice by hand, and nothing pins it

- **Unit A (contract):** `pattern: '^[^\\p{Cc}\\u2028\\u2029]*$'`, applied after `String.prototype.trim()` in `preValidation`.
- **Unit B (web, `apps/web/src/todos/`):** AD-5 lets the web import the contract by `import type` only, so the class and the 200 limit are retyped by hand. One author writes `/[\x00-\x1F\x7F]/`, which misses C1 controls such as U+0085. Another writes `\p{C}`, which also strips format characters such as ZWJ (U+200D) and breaks emoji sequences that the server would accept.
- **What breaks:** with the narrow class, a pasted U+0085 is sent, the optimistic edit is applied, the server returns `400` with `errors` naming `description`, and the user is told "Keep it to 1–200 characters.", the only `validation` reason, which is wrong for this input.
- **Proposed AD fix (AD-8):** "Pin the class as `/[\p{Cc}  ]/u` and the trim as `String.prototype.trim`. One shared table of U1 cases runs against both the server schema and the client check." Alternatively, allow one runtime import from the contract: a plain constants module with no `typebox` import. Also state that the `validation` reason covers 'contains a character that isn't allowed', or that the generic reason applies to that case.

### m4. The nginx `unavailable` body: the form of the `type` URI and its place in the contract are unpinned

- **Unit A (contract/API):** emits `type` as an absolute URI, built from a base URL.
- **Unit B (`nginx.conf`):** can't import the contract, so it hard-codes the literal `"/problems/unavailable"`. The client then classifies the nginx 503 as an unknown type, which means generic.
- **Unit C (contract suite):** validates every response against `openapi.json`. The AD-6 table lists no 503 for `/api/todos` routes, so an nginx 503 seen during I6's API restart either fails validation or is skipped, depending on the author.
- **Also:** nginx's 504 (upstream timeout) can follow a write that landed. It now reads "The server isn't available right now", with the same duplicate risk as the Deferred network-failed create, but the Deferred bullet names only `network`.
- **Proposed AD fix (AD-9, AD-4):** "`type` is exactly the relative string `/problems/<name>`. AD-4 gives the literal nginx body. `openapi.json` documents `503 unavailable` on every `/api` route. The Deferred bullet reads 'network error or `unavailable`'."

### m5. The outcome of a dropped follow-up is unspecified for its per-call promise and for the helper's own callbacks

- **Unit A (helper):** keeps per-todo order with TanStack `scope`. A mutation already queued in a scope can't be removed, so "drop" is done by having the follow-up's `mutationFn` return early when its create failed. TanStack then treats it as a success, so the helper's success path announces "Deleted “{t}”." for a follow-up delete (the false message flag 7 removed), and the per-call promise resolves.
- **Unit B (edit row):** treats a rejected per-call promise as a failed save and keeps a failed draft. Another author leaves the promise unresolved, so the awaiting handler never finishes.
- **Proposed AD fix (AD-13):** "A dropped follow-up is neither a success nor a failure. The helper doesn't announce it, record a revert for it, or count it as pending (M2), and its per-call promise resolves with a `dropped` outcome that components ignore."

---

## Checked and not a hole

- **AD-8 vs AD-13 (flag 1):** client check inline, server `400` after an optimistic write through the helper. Consistent.
- **AD-14 hidden loading status vs announcer (flag 5):** the regions don't overlap, once M5 defines "first load".
- **AD-9 three failure kinds:** complete, once M1 separates cancellation from `network`.
- **AD-13 invalidation after failed settles (flag 10):** with the `refresh` priority rule, the settle refetch can't overwrite the failure. The not-found row depends on it.
- **AD-20 `reducedMotion` / `colorScheme` projects:** one config line per project. No conflict with `workers: 1` or `beforeEach` emptying the list.
- **AD-6 health `503 unavailable` vs AD-18's post-deploy check:** the deploy check expects `200`, and both an nginx 503 and an API 503 fail it, which is correct.
