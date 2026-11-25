# Review: AD-4 and AD-6 amendment (PR #63, story 2.8, #49), versions / reality-check lens

Date: 2026-11-25
Scope: the uncommitted diff to AD-4 and AD-6 of `architecture-todo-app.md`, checked against the worktree `/Users/idris/me/todo-wt/story-2-8-security-review` (commit `c1b0095`, PR #63 open) and against nginx.org docs and nginx source on GitHub (master).

**Verdict: accept with small fixes.** Every nginx behaviour the amendment relies on was confirmed against nginx.org or the nginx source, and AD-4 matches `apps/web/nginx.conf`. Four wording problems remain: AD-6's new sentence contradicts its own table and gives the wrong reason for `DELETE`'s 400. AD-9's absolute rule now conflicts with AD-4's list of accepted exceptions. "431" is not an nginx code. "Byte for byte" is slightly overstated.

## What was checked and confirmed

| Claim (spine) | Source checked | Result |
|---|---|---|
| `/api/_nginx/invalid-request` is answered by nginx and never forwarded | `nginx.conf`: `location = /api/_nginx/invalid-request` (exact match, beats the `/api/` prefix), with `return` only and no `proxy_pass` | Confirmed (test/prod only, see F5) |
| nginx's own 400 under `/api/` becomes the validation problem | `nginx.conf`: server-level `error_page 400 = /api/_nginx/invalid-request`. nginx source: a 400 raised while the request line or headers are parsed is finalized before any location is found, so it uses the server-level `loc_conf`. A body-time 400 (invalid chunk size) uses `location /api/`'s own `error_page 400 413`. nginx.org: error_page "inherited from the previous configuration level if and only if there are no error_page directives defined on the current level", so listing 400 again in the location is required. | Confirmed |
| URI, not a named location, for the server-level 400 | nginx source `ngx_http_named_location`: `if (r->uri.len == 0) { ... "empty URI in redirect to named location" ... NGX_HTTP_INTERNAL_SERVER_ERROR }` | Confirmed: the comment in the config is correct |
| 413 for a body over 1 MiB | nginx.org: `client_max_body_size` default `1m`, 413 when exceeded. Source: the check is in `ngx_http_core_find_config_phase`, i.e. after the location is chosen, so the location-level `error_page 413` sees it. The config sets no `client_max_body_size`. | Confirmed |
| Status 400 for both | `error_page ... = uri` (no code) gives "the code it returns", and the location does `return 400 '…'` | Confirmed |
| `Content-Type: application/problem+json` | empty `types {}` plus `default_type`, the same mechanism AD-4 already uses for the 503 | Confirmed |
| AD-19's headers | `add_header ... always` at server level only. The reserved location has no `add_header`, so it inherits them. `always` covers 4xx. | Confirmed; also pinned by `expectSecurityHeaders` in `todos.contract.test.ts` |
| Paths outside `/api/` keep nginx's pages | The reserved location's `if ($request !~ "^[^ ]+ /api/") { return 400; }`. nginx source `ngx_http_special_response_handler`: error pages apply only `if (!r->error_page && ...)`, and with `recursive_error_pages off` (nginx.org default) `r->error_page = 1` is set on the first redirect, so the bare `return 400` gets the built-in page. `ngx_http_send_special_response` sets `text/html`. | Confirmed; pinned by `headers.profile.test.ts` (`GET /%zz`) |
| Body matches the API's | `apps/api/src/problems.ts` `PROBLEMS.validation` = `{type,title,status,detail}`, with the same strings and key order as the nginx literal | Confirmed, with one caveat (F4) |
| `DELETE` documents 400 | `routes/todos.ts` `400: problemResponses[400]`. `openapi.json` `DELETE /api/todos/{id}` responses `204,400,404,500,503`. | Confirmed |
| Accepted gaps (405 e.g. TRACE, 411, 414, 501, absolute-form, `//api/`) | Match security report S9 and the #28 decision. nginx.org `large_client_header_buffers`: a request line that is too long gives 414. `merge_slashes` normalises `//api/` for location matching, but `$request` keeps the raw spelling, so the regex misses it. | Consistent |

## Findings

### F1 (medium): AD-6's new sentence contradicts AD-6's own table, and gives the wrong reason for DELETE's 400

New text: "`DELETE`'s `400` is the validation problem (AD-9) for an id the server can't parse (malformed percent-encoding), as `GET` and `PATCH` already answer."

- **"as `GET` ... already answer":** the table lists `GET /api/todos` with errors `—`, and `openapi.json` documents no 400 for `GET /api/todos` or `GET /api/health`. `GET /api/todos/{id}` is not a route. The only `GET` 400s are the ones security report S7 *accepted as undocumented*. Read against the table, the sentence says something the contract does not.
- **The reason:** through the web origin (AD-4: the browser reaches the API only through nginx), a malformed percent-encoding on `DELETE` never reaches the API. nginx refuses it while parsing the request line and answers the problem itself through the server-level `error_page 400`. `todos.contract.test.ts` names it "from nginx". The cases the *API* answers on `DELETE` are the other two in S6: a JSON content type with an empty body (contract test "DELETE … with a JSON content type and an empty body") and an id over Fastify's `maxParamLength` of 100 (Fastify's 414, mapped to 400; S8). Naming only the %-encoding case hides the two cases that made the route need the documentation.

Suggested wording:
> `DELETE`'s `400` is AD-9's validation problem for a request refused before the handler runs: an id longer than 100 characters, a JSON `Content-Type` with an empty body, or a malformed percent-encoding (which, through nginx, nginx answers itself: AD-4). `PATCH` already documents the same `400`.

### F2 (medium): AD-6 and AD-9 are not updated for nginx's 400, so the rest of the spine now contradicts AD-4

- AD-6 says every `/api` route can also answer nginx's `503` and that `openapi.json` documents it on every route. Since this change, every `/api` route can also answer nginx's `400` (a body over 1 MiB or a bad escape, including on `GET /api/todos` and `GET /api/health`). `openapi.json` documents that 400 only on `POST`, `PATCH` and `DELETE`. S7 accepted that gap, but the spine does not record it, so a reader of AD-6 would conclude `GET` can never answer 400.
- AD-9 still says, without exception, "Every non-2xx response under `/api` is `application/problem+json`" and "One Fastify error handler produces every API problem". AD-4 now (correctly) lists accepted cases where nginx's HTML still comes back under `/api/`, and nginx is now a second producer of `validation`, not only of `unavailable`. AD-9's `unavailable` sentence names nginx, but nothing names nginx for `validation`.
- AD-20 says the contract suite "validates every response against `openapi.json`". The `GET /api/todos/%zz` contract test cannot do that (no 400 is documented) and asserts the literal body instead.

Suggested wording:
- AD-6, after the 503 sentence: "Every `/api` route can also answer nginx's `400` validation problem for a request nginx refuses itself (AD-4). `openapi.json` documents `400` only where the API also answers it (`POST`, `PATCH`, `DELETE`), not on `GET /api/todos` or `GET /api/health` (accepted, security report S7)."
- AD-9: "Every non-2xx response under `/api` is `application/problem+json`, except the nginx cases AD-4 accepts as not covered." Also: "nginx answers `validation` for its own 400 and 413 under `/api/` (AD-4)".
- AD-20, optional: "...validates every response to a documented route and status against `openapi.json`. nginx's undocumented `400` on a `GET` is checked against the literal body instead."

### F3 (low): "431/494" names a code nginx never sends, and hides that the client sees a 400

nginx's source (`ngx_http_special_response.c`) has no 431. Its internal 494 (`NGX_HTTP_REQUEST_HEADER_TOO_LARGE`: a request header field over one `large_client_header_buffers` buffer, 8k by default, per nginx.org) goes out with a **400** status line, as do 495–497. `error_page` matches the internal code (494), not 400, so an over-large header under `/api/` gets nginx's **HTML 400**. That sits awkwardly beside AD-4's sentence "When nginx itself refuses a request under `/api/` with `400` … it answers through `/api/_nginx/invalid-request`": a client can see a 400 under `/api/` that is HTML.

Suggested wording: replace "431/494" with "494 (an over-large request header, which nginx sends as an HTML `400`)". Optionally, `error_page 400 413 494 = /api/_nginx/invalid-request;` would cover it, but that is a code change for a later story.

### F4 (low): "byte for byte the API's own body for an invalid request" is overstated

The API's validation problem carries an `errors` array whenever schema validation names a field (`problems.ts`: `{ ...PROBLEMS.validation, errors }`). nginx's literal matches only the API's *bare* validation problem (bad JSON, an empty body, a bad escape, an overlong id). Suggested wording: "byte for byte the API's validation problem without `errors`".

### F5 (low): "never forwards" holds only in test/prod

In `dev` the Vite proxy is the web tier (AD-4's own sentence). It forwards `/api/_nginx/invalid-request` to the API, which answers 404, and the API answers malformed or oversized requests itself. Suggested wording: "...the reserved path `/api/_nginx/invalid-request`, which nginx (test/prod) answers itself and never forwards".

### F6 (info, outside the spine text): the reasoning about `$request` for unparseable lines is wrong

The spine only lists "request lines nginx can't parse" as accepted, which is safe. But the reasoning behind it in security report S9 and in the #28 decision ("`$request` is then empty") is false. nginx's `ngx_http_variable_request_line` falls back to `r->request_start` and returns the raw bytes up to CR/LF when `request_line` was never set. So some unparseable lines that begin `METHOD /api/` *do* get the problem. The gap is smaller than described, not larger. No spine change is needed. Correct the report or the conf comment if the wording gets reused. (The conf comment is about `$request_uri` being empty for a URI that failed to parse, and that part is correct.)

## Not checked

- What Cloudflare's edge does with these requests in prod (the security report also leaves this open).
- The tests were not run (read-only review; no docker).
