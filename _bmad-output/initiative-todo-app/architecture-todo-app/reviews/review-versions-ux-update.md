---
review: versions-and-fit (UX-flag amendments)
target: architecture-todo-app.md AD-4, AD-8, AD-9, AD-11, AD-13, AD-14, AD-20 (working-tree amendments of 2026-11-24) + .memlog.md (version) entry of 2026-11-24
reviewed: 2026-11-24
method: live official docs (tanstack.com v5 "latest", ajv.js.org, nginx.org, docs.docker.com, playwright.dev) plus upstream source on GitHub main/master (TanStack/query query-core, ajv-validator/ajv, fastify/ajv-compiler, nginx/nginx, moby/moby via gh api). Stack versions out of scope (verified 2026-11-23).
verdict: PASS WITH CORRECTIONS (1 high, 3 medium, 5 low)
---

# Version and fit review: UX-flag amendments to the Todo App v1 spine

## Verdict

**Pass with corrections.** The library facts recorded in the memlog's 2026-11-24 `(version)` entry hold up: per-call `mutate` callbacks, `mutateAsync`, `retry`, the function form of `refetchOnWindowFocus`/`refetchOnReconnect`, Playwright `reducedMotion`/`colorScheme` per project, and Ajv `unicodeRegExp`. Two claims had no `(version)` entry behind them: that `setQueryData` sets status to `success`, and that cancelling a query with no data is safe. Both turn out to be true.

The nginx and query-policy claims were asserted, not checked, and they don't hold as written:

1. **High (AD-4).** "nginx resolves `api` per request through Docker DNS, so it never pins a stale IP" is false with a plain `resolver 127.0.0.11`. Docker's embedded DNS answers with a 600 s TTL, and nginx caches answers for the TTL.
2. **Medium (AD-11/AD-13).** AD-11 records **loaded** and **last fetch failed** from inside the query function. AD-13 cancels in-flight fetches, and that cancel reaches the query function as an abort. Unless the hooks ignore aborted runs, the cancel is recorded as a failed fetch, or as a successful load whose data TanStack threw away.
3. **Medium (AD-11).** The "predicate form of the options" gates only focus and reconnect (and mount, if added). `refetch()` (Try again) ignores those predicates and even `enabled: false`. `refetchOnMount` is not gated at all.
4. **Medium (AD-9/AD-11/AD-13).** The default `networkMode: 'online'` pauses queries and mutations after the browser's `offline` event instead of failing them. The `network` failure kind, the revert and the announcement then never happen. The spine doesn't pin `networkMode`.

## Confirmed (no change needed)

| Claim (AD) | Evidence | Source |
| --- | --- | --- |
| `retry: false` on a query disables retries. The client default is 3 (AD-11) | "If `false`, failed queries will not retry by default … Defaults to `3` on the client" | https://tanstack.com/query/latest/docs/framework/react/reference/useQuery |
| `refetchOnWindowFocus` and `refetchOnReconnect` accept a function (AD-11) | "If set to a function, the function will be executed with the latest data and query to compute the value." Type `(query) => boolean \| 'always'`. The same holds for `refetchOnMount` | same |
| Mutations don't retry by default (AD-13 "retries nothing automatically") | `useMutation` `retry` default `0` | https://tanstack.com/query/latest/docs/framework/react/reference/useMutation |
| Per-call `mutate` callbacks fire once, for the latest call, and not after unmount (AD-13) | "When passed to the `mutate` function, they will be fired up only _once_ and only if the component is still mounted"; "won't run if your component unmounts _before_ the mutation finishes" | https://tanstack.com/query/latest/docs/framework/react/guides/mutations |
| `mutateAsync` gives a per-call promise (AD-13) | "Use `mutateAsync` instead of `mutate` to get a promise which will resolve on success or throw on an error" | same |
| `setQueryData` sets status to `success` (AD-11 rationale, memlog flag 4) | Not stated in the docs. The source confirms it: `setData` dispatches `{ type: 'success', manual }`, and the reducer applies `successState(...)` (status `success`, `dataUpdatedAt`). A manual write leaves `fetchStatus` untouched | https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/query.ts ; https://tanstack.com/query/latest/docs/reference/QueryClient |
| `cancelQueries` on a query with no data yet is safe (AD-13 "before the first load, too") | With the default `revert: true`, the state reverts to the pre-fetch snapshot (`status: 'pending'`) with `fetchStatus: 'idle'`. The fetch promise rethrows `CancelledError` because `state.data === undefined`, but no `{ type: 'error' }` is dispatched, so the query never shows an error state. A later `setQueryData` then moves it to `success` | query.ts (above) ; https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation |
| The optimistic write applies at once even when a todo's mutation is queued behind an earlier one in its scope (AD-13) | In `Mutation.execute()`, `onMutate` runs before `retryer.start()`. The scope queue gates only the retryer (`canRun`). A queued mutation has `status: 'pending'` and `isPaused: true`, so `isMutating()` counts it | https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/mutation.ts ; https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/mutationCache.ts |
| Ajv compiles `pattern` with the `u` flag by default (AD-8) | "By default Ajv uses unicode flag "u" with "pattern" and "patternProperties", as per JSON Schema spec." `core.ts`: `unicodeRegExp: o.unicodeRegExp ?? true`. `usePattern`: `const u = opts.unicodeRegExp ? "u" : ""` | https://ajv.js.org/options.html ; https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/core.ts ; https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/vocabularies/code.ts |
| `Ajv2020` in the contract suite behaves the same (AD-20) | `class Ajv2020 extends AjvCore`. Its constructor spreads the caller's options and adds only `dynamicRef`, `next` and `unevaluated`, so `unicodeRegExp` stays `true` | https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/2020.ts |
| `@fastify/ajv-compiler` (Fastify's default) leaves `unicodeRegExp` alone (AD-8) | Its defaults are `coerceTypes: 'array'`, `useDefaults: true`, `removeAdditional: true`, `allErrors: false`. None of them sets `unicodeRegExp` or `unicode`. See L1 for the other two defaults | https://raw.githubusercontent.com/fastify/ajv-compiler/main/lib/default-ajv-options.js |
| "1–200 Unicode code points" is what Ajv `minLength`/`maxLength` count (AD-8) | `limitLength.ts`: unless `opts.unicode === false`, the length is `ucs2length(data)` (code points), so a surrogate pair counts as 1. This matches the client's `[...s].length` | https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/vocabularies/validation/limitLength.ts |
| nginx `error_page 502 503 504 =503 @named` is valid syntax (AD-4) | The syntax is `error_page code ... [=[response]] uri;`, and named locations are allowed. In source, `r->err_status = overwrite` is set and then `ngx_http_named_location` runs. If the named location does `return 503 '…'`, the `=503` is redundant but harmless | https://nginx.org/en/docs/http/ngx_http_core_module.html#error_page ; https://raw.githubusercontent.com/nginx/nginx/master/src/http/ngx_http_special_response.c |
| `error_page` catches nginx's own 502/504 (connect refused, DNS failure, timeout) without `proxy_intercept_errors`. The API's own `503` problem from `/api/health` passes through untouched (AD-4/AD-9) | `proxy_intercept_errors` (default `off`) only governs "proxied responses with codes greater than or equal to 300" | https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_intercept_errors |
| A variable `proxy_pass` keeps `/api/*` unchanged when it has no URI part (AD-4) | With variables, "if URI is specified in the directive, it is passed to the server as is, replacing the original request URI". So write `proxy_pass http://$api_upstream;` with no path | https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass |
| `return 503 '<json>'` takes its Content-Type from `default_type` (AD-4) | It does when the URI has no file extension. `ngx_http_script_return_code` calls `ngx_http_send_response(..., NULL, ...)` with ct NULL, which goes to `ngx_http_set_content_type`, which tries the extension in `types_hash` first and then falls back to `clcf->default_type`. See L2 | https://raw.githubusercontent.com/nginx/nginx/master/src/http/ngx_http_script.c ; https://raw.githubusercontent.com/nginx/nginx/master/src/http/ngx_http_core_module.c |
| Docker's embedded DNS is at `127.0.0.11` (AD-4) | "The embedded DNS server address is 127.0.0.11". It applies to custom networks, and compose's default project network is one | https://docs.docker.com/engine/network/ |
| Playwright `use.reducedMotion` and `use.colorScheme` can be set per project (AD-20) | TestOptions: "usually provided in the configuration file through testConfig.use and testProject.use", and can be overridden per file with `test.use()`. That suits the one motion-on spec (`reducedMotion: 'no-preference'`) | https://playwright.dev/docs/api/class-testoptions |
| `reducedMotion: 'reduce'` only emulates the media feature, so the app's CSS and JS must honour it (AD-20 "browser emulation, not an app flag") | "Emulates 'prefers-reduced-motion' media feature". Nothing says it disables animations itself. The UX spines already make every transition instant under reduced motion, and EXPERIENCE.md sets the leaving-row timer to 0 under it. That timer is JS, so it must read `matchMedia('(prefers-reduced-motion: reduce)')`. The docs show emulation driving `matchMedia` for `colorScheme`, and `reducedMotion` goes through the same `emulateMedia` mechanism (inferred, not stated) | https://playwright.dev/docs/api/class-page#page-emulate-media |
| A `colorScheme: 'dark'` project audits dark mode (AD-20) | It emulates `prefers-color-scheme`, which the UX spines use for dark mode (ux memlog: "light + dark in v1, following prefers-color-scheme") | https://playwright.dev/docs/api/class-testoptions |

## Findings

### H1 — AD-4: nginx does not resolve `api` per request; it caches Docker DNS answers for 600 s

- **Claim:** "nginx resolves `api` per request through Docker DNS, so it never pins a stale IP." The memlog has no `(version)` entry behind it.
- **Reality:** nginx "caches answers using the TTL value of a response. An optional `valid` parameter allows overriding it." Docker's embedded resolver answers every A and AAAA record with `Ttl: respTTL`, where `respTTL = 600` (`daemon/libnetwork/resolver.go`, moby master @ eedc67d08675). After a deploy or `restart` gives `api` a new IP, a plain `resolver 127.0.0.11;` keeps proxying to the old address for up to 10 minutes. Every `/api` call during that time becomes nginx's 503 `unavailable`, which is exactly the "stale upstream after the API restarts" that AD-4 says it prevents. Failed lookups are also held until they expire (nginx trac #1926).
- **Fix:** Put the parameter in the AD rule, for example `resolver 127.0.0.11 valid=5s ipv6=off;` (add `resolver_timeout` if wanted) together with a variable `proxy_pass`. The alternative, available in OSS since 1.27.3 and so in 1.30, is an `upstream { zone …; server api:3000 resolve; }`, which also needs `valid=` to re-resolve quickly. Change the AD wording from "per request" to "re-resolves at most every N seconds".
- **Sources:** https://nginx.org/en/docs/http/ngx_http_core_module.html#resolver ; https://github.com/moby/moby/blob/master/daemon/libnetwork/resolver.go (line 57 `respTTL = 600`, used at lines 313 and 320) ; https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve ; https://trac.nginx.org/nginx/ticket/1926

### M1 — AD-11 + AD-13: a cancelled fetch reaches the query function, so the "loaded" and "last fetch failed" facts can be wrong

- **Claim:** The hooks record **loaded** and **last fetch failed** "from the query function". The helper "cancels in-flight `['todos']` fetches … (before the first load, too)".
- **Reality:** `cancel()` aborts the query's `AbortController` unconditionally (the retryer's `onCancel` calls `abortController.abort()`). If the query function passes `signal` to `fetch`, the fetch rejects with an `AbortError`. A wrapper that records "last fetch failed" in its `catch` will then flip the list to the error panel when an add happens during the first load. If the query function does **not** consume `signal`, TanStack still rejects the retryer and discards the result, but the fetch runs to completion. A wrapper recording on resolve then sets **loaded** = true, while the cache holds only the optimistic add. The list then shows a false Populated (or Empty) state until the settle-time invalidation.
- **Fix:** Add to AD-11: the query function passes `signal` to the API client, and it records neither fact when `signal.aborted` is set. A cancelled fetch is neither a success nor a failure. AD-9's `network` kind should also exclude an abort that the client caused itself.
- **Sources:** https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/query.ts ; https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation

### M2 — AD-11: the option predicates can't gate Try again or a remount; only focus and reconnect are covered

- **Claim:** "No `['todos']` fetch starts while a todo mutation is pending, whether it comes from focus, reconnect, Try again or invalidation." The memlog (flag 8) says this uses the "predicate form of the options".
- **Reality:**
  - `refetchOnWindowFocus` and `refetchOnReconnect` predicates cover only their own triggers.
  - `refetch()` from `useQuery`, which Try again would call, ignores both predicates and even `enabled: false`: "`refetch` returned from `useQuery` can be used to manually trigger the query to fetch."
  - `refetchOnMount` (default `true`, and `staleTime` defaults to 0) starts a fetch whenever a new `['todos']` observer mounts. That happens if the list component or a second consumer remounts, for example when switching between the error panel and the list. The AD doesn't list it.
  - Using `enabled: () => isMutating() === 0` instead isn't a fix. It would also make the query ignore `invalidateQueries`/`refetchQueries` ("The query will ignore query client `invalidateQueries` and `refetchQueries` calls"), so a function `enabled` re-evaluated only on render could swallow the settle-time invalidation.
  - The helper's own invalidation is self-gated by AD-13, so it is fine.
- **Fix:** Spell out the mechanism in AD-11: one predicate `() => queryClient.isMutating({ mutationKey: ['todos'] }) === 0` for `refetchOnWindowFocus`, `refetchOnReconnect` **and** `refetchOnMount`, plus an explicit guard in the hook's Try again (a no-op while mutations are pending). Don't use `enabled` for this.
- **Sources:** https://tanstack.com/query/latest/docs/framework/react/reference/useQuery ; https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries ; https://tanstack.com/query/latest/docs/reference/QueryClient

### M3 — AD-9/AD-11/AD-13: default `networkMode: 'online'` pauses instead of failing, so offline writes never revert or announce

- **Claim (implicit):** Every failed write reverts and announces (AD-13), "`network`, when `fetch` rejects" (AD-9), and the list shows an error panel or refresh failure from fetch outcomes (AD-11). The spine doesn't mention `networkMode`.
- **Reality:** In the default mode, "Queries and Mutations will not fire unless you have network connection". They wait with `fetchStatus: 'paused'` (queries) or `isPaused` (mutations) and continue on reconnect. TanStack v5's `onlineManager` starts `online = true` and flips only on the window `offline`/`online` events, without reading `navigator.onLine`. So:
  - A cold load while offline still fires and fails. EXPERIENCE.md's offline failure path works.
  - Once a session goes offline, adds, edits and deletes stay optimistic with no revert and no message, and they are sent later on reconnect. That is a deferred automatic send the spine never chose.
  - A Try again or refresh while offline sits paused, so the list keeps its current state, and before the first load it shows the skeleton.
  - E2e won't catch this because AD-20 injects failures only through `page.route` (`abort`), which doesn't fire `offline`.
- **Fix:** Pin `networkMode: 'always'` for the `['todos']` query and the helper's mutations, so the failure model above holds, or explicitly accept and spec pausing. With `'always'`, `refetchOnReconnect` "defaults to `false`", so set it explicitly (to the M2 predicate) to keep AD-11's "refetch on reconnect is on".
- **Sources:** https://tanstack.com/query/latest/docs/framework/react/guides/network-mode ; https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/onlineManager.ts ; https://tanstack.com/query/latest/docs/framework/react/reference/useQuery (`refetchOnReconnect`: "Defaults to `true` unless `networkMode` is `'always'`")

### L1 — AD-8: Fastify's default Ajv contradicts the rule; the override is load-bearing

AD-8's target config is right. But `@fastify/ajv-compiler` defaults to `coerceTypes: 'array'` and `removeAdditional: true`. With `additionalProperties: false`, the second **silently strips** unknown fields instead of rejecting them, which is the coercion AD-8 forbids. The epic-1 story needs `ajv: { customOptions: { coerceTypes: false, removeAdditional: false } }` and a test that an extra field gets a `400`. If the project ever switches to `TypeBoxValidatorCompiler`, AD-8 ("the API's Ajv") stops holding, and TypeBox's own regex flags apply instead (not checked here).
Sources: https://raw.githubusercontent.com/fastify/ajv-compiler/main/lib/default-ajv-options.js ; https://raw.githubusercontent.com/fastify/fastify/main/lib/schema-controller.js ; https://raw.githubusercontent.com/fastify/fastify-type-provider-typebox/main/README.md

### L2 — AD-4: `default_type` loses to the request's file extension

`ngx_http_set_content_type` looks up `r->exten` in `types_hash` before falling back to `default_type`. A request such as `/api/todos/x.html` while the API is down would get `text/html` with the JSON body. Put `types { } default_type application/problem+json;` in the named location. The error response also needs `add_header … always` if the AD-19 security headers should appear on a 503, because `add_header` without `always` skips error codes.
Sources: https://raw.githubusercontent.com/nginx/nginx/master/src/http/ngx_http_core_module.c ; https://nginx.org/en/docs/http/ngx_http_core_module.html#default_type

### L3 — AD-13: "when no todo mutation is still pending" must count the settling mutation itself

`isMutating()` "Returns the number of mutations in the cache that are currently pending", and the settling mutation is still pending inside its own `onSettled`. So the check there is `isMutating({ mutationKey: ['todos'] }) === 1`, not `=== 0`, called imperatively rather than through `useIsMutating`. The helper's mutations need a shared `mutationKey` so that filter works.
Sources: https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query (2025-04-28) ; https://tanstack.com/query/latest/docs/reference/QueryClient

### L4 — AD-13: per-todo ordering and dropping follow-ups are the helper's own work, not TanStack features

`scope` is a **per-hook** option ("Mutations sharing the same `scope.id` run serially"), and `mutate` accepts no per-call scope. A single shared helper therefore needs one of two things: a mutation built per call with `scope: { id: todoId }`, or its own per-todo queue. When a create fails, TanStack's `runNext` simply continues the next paused mutation in the scope, and there is no API to remove queued mutations. "Drops that todo's queued follow-ups" therefore has to be a short-circuit in the helper's own `mutationFn`. Nothing in the AD is wrong. It just doesn't name the mechanism.
Sources: https://tanstack.com/query/latest/docs/framework/react/reference/useMutation ; https://raw.githubusercontent.com/TanStack/query/main/packages/query-core/src/mutationCache.ts

### L5 — AD-8/AD-20: write the pattern with escapes, and never relax the `u` flag

`\p{Cc}` means "control character" only under the `u` flag. Without it, it's an identity escape. Ajv, Ajv2020 and the client's `/…/u` literal all use `u`, so all three agree. Two precautions:
- The contract suite will probably need `strict: false`, or custom keywords, to load an OpenAPI document into Ajv2020. Whatever is relaxed, `unicodeRegExp` must not be.
- Write U+2028 and U+2029 as `  ` escapes in the TypeBox source rather than as literal invisible characters (`'^[^\\p{Cc}\\u2028\\u2029]*$'` in a TS string), so `openapi.json` diffs stay readable.

Source: https://ajv.js.org/options.html

## Provenance check (memlog vs claims)

| Claim | Memlog `(version)` 2026-11-24? | Now |
| --- | --- | --- |
| Per-call `mutate` callbacks, `mutateAsync`, query `retry`, refetch predicates | yes | confirmed |
| Playwright `reducedMotion` and `colorScheme` per project | yes | confirmed; media-feature-only also confirmed |
| Ajv `unicodeRegExp` default | yes | confirmed; Ajv2020 and Fastify's compiler checked too |
| `setQueryData` sets `success` | no (asserted in a decision line) | confirmed from source |
| `cancelQueries` before the first load | no | safe in TanStack; unsafe for the hook's own recording (M1) |
| Predicates gate Try again and invalidation | no | wrong for Try again and mount (M2) |
| nginx per-request resolution, error_page and default_type | no | resolution wrong (H1); the rest holds with L2 |
| Offline and `networkMode` behaviour | not considered | gap (M3) |
