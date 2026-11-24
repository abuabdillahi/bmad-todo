# Reality check: versions and behaviour for the UX flags 11 and 12 amendment (AD-8, AD-11, AD-14)

Reviewer: reality-check (versions). Scope: AD-8, AD-9, AD-11, AD-13 and AD-14 as amended in the update logged in `.memlog.md` under "update started: UX flags 11 and 12", checked against the Stack table pins. Sources: the published npm tarballs of `@tanstack/query-core@5.108.4` (the version `@tanstack/react-query@5.108.4` depends on), `ajv@8.20.0` and `@fastify/ajv-compiler@4.0.8`; regex behaviour run in JavaScriptCore (`osascript -l JavaScript`); current screen-reader support data.

## Verdict

**Sound. Two small fixes recommended, none blocking.** The rationale for flag 11 is correct for TanStack Query 5.108.4: `setQueryData` moves an errored query to `status: 'success'` with `error: null`. The store design can be built as written, and no v5 behaviour leaves the query function recording the wrong failure kind, with one narrow edge noted in F2. AD-8's class is valid for Ajv 8.20.0 under Fastify and for browser RegExps, and it matches `\n`, `\r`, `\t`, U+2028 and U+2029. Nothing in AD-14 blocks the recovery line. It will be spoken in NVDA and JAWS. VoiceOver on macOS Safari is buggy with polite regions, and the amendment creates a new case where two live regions update close together (F1).

## Answers to the four questions

### 1. Does `setQueryData` move an errored query to `success` and null its `error`? Yes.

- `QueryClient.setQueryData` calls `query.setData(data, { manual: true })`, which dispatches `{ type: 'success', manual: true }` (`query.ts` L390–405).
- The `success` reducer case spreads `successState(...)` (L988–1003). `successState` returns `{ data, dataUpdatedAt, error: null, isInvalidated: false, status: 'success' }` (L1083–1091). `manual: true` leaves only `fetchStatus` and `fetchFailureCount/Reason` untouched.
- Two more v5 paths clear or rewind `error`, which also supports the decision:
  - Starting a fetch while `data === undefined` resets the query to `status: 'pending', error: null` (`fetchState`, L1056–1075). A Try again before the first load blanks `error` as soon as it starts.
  - `cancelQueries` defaults to `revert: true` (`queryClient.ts` L466). Its `onCancel` restores the state from before the fetch (L853–858), which can bring back an older `error`.
- The docs say nothing about status or error. They say only that the cache is "immediately update[d]", and that an updater returning `undefined` skips the write. The source is the authority here.

Evidence: https://github.com/TanStack/query/blob/%40tanstack/query-core%405.108.4/packages/query-core/src/query.ts (L390, L853, L988, L1056, L1083); https://github.com/TanStack/query/blob/%40tanstack/query-core%405.108.4/packages/query-core/src/queryClient.ts (L462–466); https://tanstack.com/query/v5/docs/reference/QueryClient

### 2. Can the store design be built as described? Yes.

- **Cancellation never surfaces as an error.** `retryer.cancel()` rejects its promise with a `CancelledError` and then calls `onCancel`, which runs `abortController.abort()` (`retryer.ts` L167–173, `query.ts` L853–860). In `Query.fetch`'s catch block (L901–915), a `CancelledError` with `silent` (the `cancelRefetch` path) or `revert` (the `cancelQueries` default) returns or rethrows *before* the `error` dispatch. The query never becomes `status: 'error'` on a cancel. The query function's own `fetch` rejects with the signal's `AbortError`, and AD-9 and AD-11 already classify that by `signal.aborted`, not as `network`.
- **No refetch skips the query function in a way that loses an outcome.**
  - `refetchQueries` and `invalidateQueries` default to `cancelRefetch: true`. When the query has data, they silently cancel the in-flight fetch (its query function sees the abort and records nothing) and start a new one.
  - When the query has no data, they join the in-flight fetch, whose query function still records the outcome.
  - After an optimistic `setQueryData`, `isInvalidated` is `false` and `dataUpdatedAt` is now. With the default `staleTime: 0` the query is still stale, so focus and reconnect refetches still fire (`queryObserver.ts` `shouldFetchOn`/`isStale`, L918–972).
- **Refetch predicates are supported.** `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` accept `(query) => boolean | 'always'` and are resolved per event (`resolveQueryValue`, L929). A predicate that reads the store's pending count works.
  - One nuance, harmless here: when `data === undefined`, the first mount loads via `shouldLoadOnMount` (L877) and ignores the `refetchOnMount` predicate. The pending count is 0 at first mount, and every later case has optimistic data in the cache.
- **Before the first load, the AD-13 cancel is clean.** Cancelling with `revert` while `data === undefined` restores the pre-fetch state with `fetchStatus: 'idle'`. It rethrows `CancelledError` without dispatching `error` (L906–911), and the helper's `setQueryData` then writes the optimistic list. The store's loaded, last fetch failure and retry requested are untouched. The list stays in its loading state until the AD-13 invalidation at count 0, as EXPERIENCE "Add during Loading" says.
- **Wiring.** `QueryFunctionContext` carries `client`, not the store. Bind the query function to the store when both are created, for example `queryClient.setQueryDefaults(['todos'], { queryFn: makeTodosQueryFn(store), retry: false, networkMode: 'always', ... })`. That way the invalidation fetch, which uses the query's stored options, always runs the recording function.
- One edge needs a sentence: see F2.

Evidence: https://github.com/TanStack/query/blob/%40tanstack/query-core%405.108.4/packages/query-core/src/retryer.ts (L167–173, L236–270); query.ts L853–915; https://github.com/TanStack/query/blob/%40tanstack/query-core%405.108.4/packages/query-core/src/queryObserver.ts (L877–972)

### 3. AD-8 class `[\p{Cc}  ]` with the `u` flag: valid, and it matches all five.

- **Ajv.** Ajv 8.20.0 defaults `unicodeRegExp` to `true` (`lib/core.ts` L264). The `pattern` keyword compiles with `new RegExp(pattern, "u")` (`lib/vocabularies/code.ts` L96–103, `validation/pattern.ts`).
- **Fastify.** `@fastify/ajv-compiler@4.0.8`'s defaults (`coerceTypes: 'array'`, `useDefaults: true`, `removeAdditional: true`, `allErrors: false`) do not touch `unicodeRegExp`, so the `u` flag holds under Fastify. AD-8 already overrides `coerceTypes` and `removeAdditional`.
- **Browsers.** `\p{...}` with `u` is ES2018: Chrome 64, Firefox 78 and Safari 11.1 onward. With `u`, ` ` and ` ` are valid RegExp escapes, and the JSON in `openapi.json` carries them as `\\u2028`, which parses back to the same escape text.
- **Run in JavaScriptCore.** The class matches LF, CR, TAB, U+2028, U+2029, NUL, DEL and C1 U+0085. `Cc` is U+0000–001F plus U+007F–009F. It does not match NBSP, ZWJ or an astral emoji, as intended. The full pattern `^[^\p{Cc}  ]*$` rejects each forbidden character inside a string and accepts plain text.
- Two practical traps are covered in F3.

Evidence: https://github.com/ajv-validator/ajv/blob/v8.20.0/lib/core.ts ; https://github.com/ajv-validator/ajv/blob/v8.20.0/lib/vocabularies/code.ts ; https://github.com/fastify/ajv-compiler/blob/main/lib/default-ajv-options.js ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape ; https://www.unicode.org/reports/tr44/#General_Category_Values

### 4. Will the recovery line be spoken? Yes in NVDA and JAWS. VoiceOver on macOS is less reliable. AD-14 does not prevent it.

- **Preconditions are met.** A polite region that already exists in the DOM and then gets new text is announced by NVDA + Firefox/Chrome and JAWS + Chrome, after the current utterance's first break. EXPERIENCE.md already sets up the preconditions that matter:
  - always mounted and empty at mount;
  - visually hidden, never `display:none`, `hidden` or `aria-hidden` ("No live region announces when hidden");
  - a sibling of the list area (region 4 vs 5), so it is not inside the skeleton list's `aria-busy="true"`;
  - the recovery line is skipped when focus moves to the list.
- **VoiceOver + macOS Safari is rated buggy for polite regions.** They are not announced during read-all, and "some content is lost". WebKit has open reports of VoiceOver skipping live-region text during view or focus changes.
- **AD-14 wording.** AD-14's wording ("at most one recovery line when the list becomes loaded … Once loaded, it is silent") does not contradict this. The recovery line belongs to the transition, and silence follows it.

Evidence: https://adrianroselli.com/2026/01/live-region-support.html ; https://bugs.webkit.org/show_bug.cgi?id=222189 ; https://dev.to/mspk97/screen-reader-handling-of-aria-live-regions-timing-interruptions-and-debugging-404p

## Findings

### F1 [medium] The recovery line can collide with an Announcer status from the same user action, and AD-14 does not coordinate the two regions

**Scenario.** EXPERIENCE's "Add during Loading" path:
1. The first load is slow, so the loading status says "Loading your todos" after about 500 ms.
2. The user adds a todo. The helper cancels the load.
3. The add is confirmed, and the Announcer says `Added` (AD-13).
4. The count reaches 0, the invalidation fetch succeeds about 50–300 ms later, and the loading status says "Your todos are loaded."

The same happens when an add or delete made during Error settles and its settle-time refetch recovers the list. Two polite regions then update within a few hundred ms. NVDA batches changes that arrive close together and may read only the last. VoiceOver on macOS lets a later polite update cut off an earlier one. Roselli rates VoiceOver + Safari polite as buggy, with content lost.

**Effect.** The user may hear only "Your todos are loaded." and lose the `Added` confirmation, or the reverse. This is a cross-unit interaction between the helper, the Announcer and the list's loading status, which the spine exists to settle. Before the amendment, the loading status was silent at this transition, so this collision did not exist.

**Evidence:** https://adrianroselli.com/2026/01/live-region-support.html ; https://dev.to/mspk97/screen-reader-handling-of-aria-live-regions-timing-interruptions-and-debugging-404p ; https://bugs.webkit.org/show_bug.cgi?id=222189

**Fix.** Add one clause to AD-14's loading-status exception: "The recovery line is skipped if the Announcer set a message in the last 2 s." The store, or the Announcer's own state, exposes a last-announced timestamp for this. The alternative is to delay the recovery line until the Announcer has been idle for 1 s. Either way, add the case to the K5 test list: add during a slow first load, then assert that only one line lands in the recovery window.

### F2 [low] The rule "A fetch that ends with that signal aborted records nothing" has to cover the success path too, and implementers will read it as catch-only

**Problem.** On cancel, TanStack rejects the retryer at once and aborts the signal (`retryer.ts` L167–173). The query function keeps running, and anything it resolves afterwards is discarded (`.then(resolve)` on an already-settled promise). If the API client's response parsing completes after the abort, the query function would return data and, as written, record "loaded" and clear the failure. TanStack never stores that data. The store would then say loaded while the cache holds only optimistic entries.

The real-world window is small, because a body read after abort normally rejects. MSW handlers in K-layer tests, however, can resolve regardless of the abort.

**Evidence:** https://github.com/TanStack/query/blob/%40tanstack/query-core%405.108.4/packages/query-core/src/retryer.ts (L167–173, L242–247)

**Fix.** In AD-11 "Fetch outcomes are recorded once", add: "The query function checks `signal.aborted` after its last `await` and before recording either outcome. It records synchronously, immediately before returning or rethrowing." Add one unit test: an aborted fetch whose mocked response still resolves records nothing.

### F3 [low] AD-8's escape text invites a string-literal bug, and the schema pattern form is not stated

**Problem 1: a string literal changes the class.** The amendment now shows `[\p{Cc}  ]` as escape text. If an implementer pastes that into a JS/TS string literal in `description.ts` (`'[\p{Cc}  ]'`), `\p` becomes `p`, and ` `/` ` become the literal characters. The class silently becomes `[p{Cc}  ]`. Verified in JavaScriptCore:
- `'Buy cheese'` is rejected;
- `'a\nb'` is accepted.

Schema and client stay in agreement, because both derive from the one module, so only the U1 table catches it.

**Problem 2: the pattern form is not stated.** JSON Schema `pattern` is unanchored and must *match*. "No character from the class" has to be expressed as `^[^\p{Cc}  ]*$` (JS `$` without `m` does not match before a trailing `\n`, so this is exact). The alternative is `not: { pattern: '[\p{Cc}  ]' }`. Neither form is named, and a wrong one passes type-checking.

**Evidence:** https://json-schema.org/understanding-json-schema/reference/regular_expressions ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape ; https://github.com/ajv-validator/ajv/blob/v8.20.0/lib/vocabularies/validation/pattern.ts

**Fix.** In AD-8, say that `description.ts` holds the class as a RegExp literal, `/[\p{Cc}  ]/u`. The schema pattern is built from its `.source` as `^[^…]*$`, and the client replacement uses the same literal with the `g` flag added. Also require the U1 table to include `\n`, `\r`, `\t`, U+2028, U+2029, a C1 control and a plain string containing `p`, `c` and `C`.

### F4 [low] AD-14 says "hidden" loading status. The conditions that make it speakable live only in EXPERIENCE.md, and the amendment adds one that matters

**Problem.** Before the amendment, the status spoke only while not loaded. It could therefore have been rendered inside the loading/error subtree of the list area without harm. The recovery line is spoken exactly when that subtree is swapped for the list or the Empty panel. If the status is mounted inside the swapped subtree, or with `hidden`/`display:none`, the line is never spoken. EXPERIENCE.md gets this right (row 4 is separate from row 5, always mounted, visually hidden), but the spine is what other units build from. "Hidden" in AD-14 can be read as `hidden`.

**Evidence:** https://adrianroselli.com/2026/01/live-region-support.html ("No live region announces when hidden")

**Fix.** Reword AD-14's exception to "the list's one visually hidden loading status, always mounted outside the list-state subtree (and outside any `aria-busy` element) …". Keep the wording and the focus condition in EXPERIENCE.md, as the memlog decided.

## Counts

high 0 · medium 1 · low 3
