# Adversary review: AD-4 / AD-6 amendment (2026-11-25, PR #63, story 2.8)

- **Lens:** two units built one level down, each obeying every AD to the letter, that still build incompatibly.
- **Scope:** the amended AD-4 (nginx answers its own 400/413 under `/api/` through the reserved `/api/_nginx/invalid-request`) and AD-6 (`DELETE /api/todos/{id}` lists `400`). Read against AD-5, AD-8, AD-9, AD-13, AD-14, AD-19 and AD-20.
- **As-built checked:** `/Users/idris/me/todo-wt/story-2-8-security-review` at `c1b0095` (`apps/web/nginx.conf`, `apps/web/vite.config.ts`, `apps/api/src/problems.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/todos.ts`, `packages/contract/openapi.json`, the new contract and profile tests, `docs/quality/2026-11-25-epic-manage-todos-security.md`).

## Verdict

**Sound. Tighten the wording, no redesign needed.** The amendment matches the code and opens no hole that breaks the build. The client already handles nginx's new problem the same way as the API's: `client.ts` matches the media type by prefix, so a missing `; charset=utf-8` does not matter, and with no `errors` the problem gets AD-14's generic reason. Five gaps in the wording would still let two careful builders diverge. Two of them are wrong or ambiguous text in AD-6's new sentence.

## Findings

### F1 (medium): AD-6's new sentence cites a route that doesn't exist and gives too narrow a cause

> "`DELETE`'s `400` is the validation problem (AD-9) for an id the server can't parse (malformed percent-encoding), as `GET` and `PATCH` already answer."

- `GET` has no `{id}` route. `GET /api/todos` takes no id, and `openapi.json` lists no `400` for any `GET`. The `%zz` `GET` in the contract test hits a path that isn't a route, and the test says so itself ("GET of one todo is not a route, so the contract documents no 400 for it"). A builder who takes the sentence literally could add `400` to `GET /api/todos` in openapi, or register `GET /api/todos/{id}`.
- The cause is narrower than the code. `DELETE` also answers `400` for an id longer than Fastify's `maxParamLength` (100). Fastify raises its own 414, and the error handler turns it into the validation problem (see the comment on `TodoParams`). It also answers `400` for `Content-Type: application/json` with an empty body (pinned by a contract test). So "an id the server can't parse" doesn't cover every case.
- **Incompatible pair:** the web client author reads "`400` = an id the server can't parse, so the id can't exist" and treats `DELETE` `400` like `404`, a success (AD-13 makes `404` a success for the same "it's gone" reason). The helper author follows AD-8 ("a server `400` on a write ... is a mutation failure"). The same response produces a revert in one build and a silent removal in the other.
- **Suggested wording (AD-6):** "`DELETE`'s `400` is the validation problem (AD-9), without `errors`, for a request the server can't read: a malformed percent-encoding, an id longer than 100 characters, or an unreadable body. The client sends none of these. A `400` on `DELETE` is a failure; only `404` counts as success (AD-13)." Drop "as `GET` and `PATCH` already answer", or replace it with "as `PATCH` does".

### F2 (medium): nginx's 400 can answer routes whose Errors column lists none, and the openapi rule is unstated

- AD-6 states the rule for 503: "Every `/api` route can also answer `503` ... and `openapi.json` documents it on every route." The new 400 has no matching rule. nginx answers it on **any** `/api/` request it refuses: an over-1-MiB body or an invalid chunk size on `GET /api/todos` or `GET /api/health`, a malformed header line, and so on. Yet the `GET /api/todos` row says "—" and `openapi.json` lists no `400` for either `GET`.
- **Incompatible pair:** AD-20's contract suite "validates every response against `openapi.json`". One test author adds an over-limit-body case for `GET /api/todos` and checks it against the contract, which fails because no `400` is documented. Following the 503 precedent, they then add `400` to every route in openapi. Another builder reads the table as the full error list and keeps openapi as built. The two contracts differ, and AD-5's no-diff CI check flips depending on whose change lands last.
- **Suggested wording (AD-6, after the 503 sentence):** "nginx's own `400` (AD-4) can answer any `/api` request. `openapi.json` documents `400` only where this table lists it, and on other routes the contract suite checks nginx's `400` by its body and headers, not against openapi." This is exactly what the tests already do.

### F3 (medium-low): "byte for byte the API's own body for an invalid request" names two bodies and pins neither

- The API has two validation bodies: the bare one and one with `errors: [{ field, message }]` (`problems.ts`). "The API's own body for an invalid request" fits both. The 503 body is quoted in AD-4. This one is not, even though it is just as hard-coded in nginx and in the test constant `VALIDATION_BODY`.
- **Incompatible pair:** an API author rewords `PROBLEMS.validation.detail`. That obeys AD-9, which fixes only the shape and the `type`. nginx keeps the old string, which obeys AD-4 as it stood when written. "Byte for byte" now fails, and no test compares the API's bare body to `VALIDATION_BODY` (the `DELETE` empty-body test uses `toMatchObject`). The divergence passes CI until someone diffs the two.
- **Suggested wording (AD-4):** "...it answers through `/api/_nginx/invalid-request` with status `400`, `Content-Type: application/problem+json`, the literal body `{"type":"/problems/validation","title":"Invalid request","status":400,"detail":"The request is not valid."}`, which is the API's validation problem without `errors`, and AD-19's headers." Optional, for AD-20: "a test pins the API's bare validation body to the same literal."

### F4 (low): the reserved path is reserved only in nginx, and `dev` answers it differently

- AD-4 says nginx "answers [it] itself and never forwards" it. Nothing stops the API from registering a route at or under `/api/_nginx/`. The Vite proxy (`proxy: { '/api/': 'http://api:3000' }`) forwards the path like any other.
- **Incompatible pair:** someone adds an API route under `/api/_nginx/`. That obeys "the API registers every route under `/api`". It works in `dev` and in integration tests, and is shadowed in `test`/`prod`. Separately, "A direct request to that path gets the same problem" holds only behind nginx. In `dev`, the same request gets the API's `404` not-found problem. (Malformed and over-limit requests do match in `dev`, because the API itself answers the bare validation problem through `frameworkErrors` and its 1 MiB `bodyLimit`.)
- **Suggested wording (AD-4):** "The API registers no route under `/api/_nginx/`. In `dev` the Vite proxy forwards that path like any other, and the API answers not-found. No code calls it."

### F5 (low): AD-9's "every non-2xx under `/api`" now conflicts with AD-4's accepted exceptions

- AD-9 still says: "Every non-2xx response under `/api` is `application/problem+json`". AD-4 now lists nginx responses under `/api` that stay HTML: 405 (e.g. `TRACE`), 411, 414, 431/494, 501, unparsable request lines, absolute-form targets, `//api/`, and `/%61pi/`.
- **Incompatible pair:** a test author reads AD-9 and writes a check that `TRACE /api/todos` returns a problem, which fails. A config author reads AD-4 and leaves it alone. Both cite the spine.
- **Suggested wording (end of AD-4's accepted list):** "These are the only exceptions to AD-9's rule that every non-2xx under `/api` is a problem." AD-9 can instead gain "(except where AD-4 accepts nginx's own page)".

## Checked and found closed

- **Client classification (AD-9, AD-13, AD-14).** nginx sends `application/problem+json` without a charset, and the API sends it with `; charset=utf-8`. `client.ts` matches by `startsWith` after `toLowerCase`, so both are classified as a problem. The `type` maps to `validation`, and with no `errors` the message falls back to AD-14's generic reason. No layer narrows the kind differently. The spine does not say media-type parameters are ignored, but the 503 body already relied on that before this amendment, so it is not new.
- **413 → 400.** The status is the same whichever tier refuses the body. The API's own 413 also becomes the validation problem with status 400 (`isClientError`). AD-9's closed set has no 413 type, so the mapping is consistent.
- **AD-19 headers.** The reserved location has no `add_header`, so it inherits the server-level headers. The contract test (`expectSecurityHeaders`) and the profile test (`GET /%zz` stays HTML, with headers) pin this. AD-19's own wording needs no change.
- **Interplay with the 503 path.** The 400/413 redirect is a URI redirect to a `return`-only location, never a proxy, so it can't reach `@api_unavailable`, and the reverse can't happen either.
- **Paths outside `/api/`.** They keep nginx's page through the bare `return 400` (`recursive_error_pages` is off), which matches "Paths outside `/api/` keep nginx's own pages".
