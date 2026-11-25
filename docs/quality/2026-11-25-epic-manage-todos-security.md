# Security report: epic-manage-todos

- **Date:** 2026-11-25
- **Epic:** epic-manage-todos (edit, complete, reactivate and delete: `PATCH` and `DELETE /api/todos/{id}`, the Edit form, the new announcements), with every change since epic-todo-foundation's review (R20, AD-4, AD-8, AD-9, AD-19)
- **Commit measured:** `58796f0` plus story 2.8's changes on branch `story-2-8-security-review` (`apps/web/nginx.conf`: nginx's own 400 and 413 under `/api/` answer the validation problem; `apps/api/src/routes/todos.ts`: `DELETE` documents its `400`; `packages/contract/openapi.json` regenerated; new integration, contract and profile tests). Epic 1's review measured `e96a258`. Everything since then is in `git diff --stat e96a258..58796f0 -- apps packages e2e scripts compose.yml .github pnpm-lock.yaml .dockerignore .env.example`.
- **Environment:** Probes ran on `todo-test` at `http://127.0.0.1:8081` only, before and after the nginx change. Production got no request: this review's rule is no request, test or probe against the production hostname.
- **Tools:** pnpm 12.23.0 `pnpm audit` (npm advisory database, queried 2026-11-25), `git grep`, curl 8.7.1, Node 26.13.1 `node:http` and `fetch`, Playwright 1.65.1 with Chromium 159.0.8154.6, Docker 29.9.3 with Compose v5.7.1
- **Reproduce:**
  - `pnpm audit --prod` and `pnpm audit`
  - Epic 1's grep for unsafe patterns:

    ```sh
    git grep -n -E 'dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|sql\.raw|sql`[^`]*\$\{' -- apps packages e2e scripts
    ```

  - With `todo-test` up (`docker compose -p todo-test --profile test up -d --build --wait`): `docker compose -p todo-test --profile test exec api id`, `… exec web-test id`, `… logs api`, and `curl --path-as-is -D -` against the paths listed below
  - The API probe (`/tmp/story-2-8-probes/api-probe.mjs`, one-off, not committed): raw `node:http` requests through web-test for every row of the matrix below (a 1 MiB + 1 byte `POST`, `%zz` and `%E0%A4%A` ids, a `DELETE` with a JSON content type and no body, `GET /%zz`, a `PATCH` with `{}`), then `PATCH` and `DELETE` with injection ids, an id of 101 characters, and `__proto__` / `constructor` bodies. Each line prints the status, `Content-Type`, whether all seven AD-19 headers are present, and the body. It ran once before and once after the nginx change.
  - The XSS probe (`/tmp/story-2-8-probes/xss-probe.mjs`, one-off, not committed, Playwright's library from `e2e/`): empties the list, creates five todos and `PATCH`es each description to a payload, opens the page in Chromium, checks each card's text and its Edit button's `aria-label`, opens the Edit form on one payload, types a new payload into the edit field and saves it, then forces a `PATCH` failure with `page.route` (a 500 problem) so the failure announcement quotes a payload. It records dialogs and console errors and inspects the DOM.
  - On every run: I8's integration tests ("injection payloads are inert text" in `todos.test.ts` and `update-delete.test.ts`), I13's log tests (`logs.test.ts`, `logs.profile.test.ts`), and this story's I9 and I12 tests (`update-delete.test.ts` "PATCH and DELETE of a malformed request to one todo", `todos.contract.test.ts`, `headers.profile.test.ts`).

## Results

### Dependencies

No dependency, lockfile, Dockerfile, `.dockerignore` or `.github` change since `e96a258`.

| Command | Result |
|---|---|
| `pnpm audit --prod` | No known vulnerabilities |
| `pnpm audit` (dev included) | 1 moderate: GHSA-67mh-4wv8-2f99, `esbuild` ≤ 0.24.2, path `apps__api > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` (S1, unchanged) |

### Code: XSS in rendered and edited text

- `git grep` (above) finds no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `sql.raw` or interpolated `sql` template in `apps`, `packages`, `e2e` or `scripts`.
- `TodoCard.tsx` renders the description as a React text child (`<span>{todo.description}</span>`), and the Completion check's, Edit's and Delete's names are `aria-label` attribute strings built from it (`` `Edit “${todo.description}”` ``). React escapes text and sets attributes as strings, so neither is parsed as HTML.
- `EditForm.tsx` and `TextField.tsx` use a controlled `<textarea>`: the description is its `value`. Paste and drop insert cleaned plain text with `document.execCommand('insertText')` or `setRangeText`, both of which insert text, never markup.
- `todos/messages.ts` builds announcements with `quote()` (a template string), and `Announcer.tsx` renders them as text children. `TodoList.tsx` writes the Loading status with `textContent`.
- Reviewed in code only, not driven with payloads in the probe: the Delete confirm (its group is named by the prompt and the todo text, rendered as a text child), the Completion check's and Delete button's `aria-label`s, and the complete, reopen and delete announcements. They use the same React text-child and attribute-string paths as the card text, the Edit `aria-label` and the edit-failure announcement that the probe did drive.
- `api/client.ts` puts the id in the path with `encodeURIComponent(id)` for `PATCH` and `DELETE`, and `DELETE` sends no body and no `Content-Type`. The client mints ids with `crypto.randomUUID()`.

### Code: injection on update and delete

- `apps/api/src/todos/repository.ts` uses only Drizzle's query builder: `update(todos).set(set).where(eq(todos.id, id))` and `delete(todos).where(eq(todos.id, id))`, which bind parameters. `set` is built from the two known fields only. Its one raw template is still the constant ``sql`select 1` `` for the health ping.
- `PATCH` validation is strict (AD-8): `UpdateTodoBody` with `additionalProperties: false`, no coercion, the description pattern after trimming. Fastify's JSON parser refuses `__proto__` and `constructor.prototype` keys (`onProtoPoisoning` and `onConstructorPoisoning` default to `error`), so such a body is a 400 before validation.
- `TodoParams` accepts any string id: an id that is not stored is a 404, and the query is parameterised. An id over Fastify's `maxParamLength` (100) is refused by Fastify (`FST_ERR_MAX_PARAM_LENGTH`, its 414), which the one error handler answers as the validation problem (400). The route's comment said 404; see S8.

### XSS probe on todo-test (Chromium)

Each payload was stored by `PATCH` over a placeholder todo, then shown in the page. Results were the same before and after the nginx change.

| Payload | `POST` | `PATCH` | Returned verbatim | Card text equals payload | Edit `aria-label` equals `Edit “payload”` |
|---|---|---|---|---|---|
| `'; DROP TABLE todos; -- e2` | 201 | 200 | yes | yes | yes |
| `" OR 1=1 -- e2` | 201 | 200 | yes | yes | yes |
| `<script>window.__pwned=1</script>` | 201 | 200 | yes | yes | yes |
| `<img src=x onerror="window.__pwned=2">` | 201 | 200 | yes | yes | yes |
| `{{constructor.constructor('window.__pwned=3')()}}` | 201 | 200 | yes | yes | yes |

- **Edit field:** opened on the `<img …>` todo, the field's value equals the stored payload exactly. `<img src=x onerror="window.__pwned=4"> typed`, typed into the edit field and saved with Enter: `PATCH` 200, shown in the card as text.
- **Failure announcement:** with `PATCH` forced to a 500 problem, an edit of the `<script>` todo to `<svg onload="window.__pwned=5"> failed` reverted, and the Announcer read, as text: `Couldn't save your edit, so “<script>window.__pwned=1</script>” is back as it was. Something went wrong on our side. Try again.`
- **DOM:** `typeof window.__pwned` is `undefined`. The body holds no `script` element and the document no `img`. No element in the document carries an `on…` attribute. The list's only `svg` elements are the app's five check icons. No dialog opened. The console's one error is the forced 500's "Failed to load resource".
- `GET /api/todos` afterwards returned every description verbatim, and the `todos` table kept working for the rest of the session.

### API probe on todo-test: the matrix, before and after the nginx change

Every response in both runs carried all seven AD-19 headers. "Validation problem" is AD-9's literal `{"type":"/problems/validation","title":"Invalid request","status":400,"detail":"The request is not valid."}`; nginx's carries `Content-Type: application/problem+json`, the API's `application/problem+json; charset=utf-8`.

| Request through web-test | Before | After |
|---|---|---|
| `POST /api/todos`, JSON body of 1 MiB + 1 byte | 413 `text/html` (nginx's page) | 400 validation problem, `application/problem+json` (nginx) |
| `GET /api/todos/%zz` | 400 `text/html` (nginx's page) | 400 validation problem (nginx) |
| `PATCH /api/todos/%zz` | 400 `text/html` (nginx's page) | 400 validation problem (nginx) |
| `DELETE /api/todos/%zz` | 400 `text/html` (nginx's page) | 400 validation problem (nginx) |
| `DELETE /api/todos/%E0%A4%A` | 400 `text/html` (nginx's page: nginx refuses the truncated escape itself) | 400 validation problem (nginx) |
| `DELETE /api/todos/{id}`, `Content-Type: application/json`, empty body | 400 validation problem (the API), not documented for `DELETE` | same, now documented |
| `GET /%zz` (outside `/api`) | 400 `text/html`, 150 bytes | 400 `text/html`, 150 bytes (unchanged) |
| `PATCH /api/todos/{id}` with `{}` | 400 validation problem (the API) | same: passes through untouched |
| `GET /api/todos/..%2F..%2F..%2Fetc%2Fpasswd` (above the root) | 400 `text/html` (nginx's page) | 400 validation problem (nginx) |
| `GET /../../etc/passwd` | 400 `text/html` | 400 `text/html` (unchanged) |

In-process (`app.inject`, no nginx), `DELETE` and `PATCH /api/todos/%E0%A4%A` answer the API's validation problem, with no `%E0` echoed, and nothing deleted or changed. Before this story that `DELETE` answer was not in openapi.json.

### API probe on todo-test: injection on `PATCH` and `DELETE`

Run before and after the nginx change, with the same results. Ids are sent through `encodeURIComponent`.

| Id or body | `PATCH` | `DELETE` |
|---|---|---|
| `' OR 1=1 --` | 404 not-found problem | 404 not-found problem |
| `1'; DROP TABLE todos; --` | 404 | 404 |
| `" OR ""="` | 404 | 404 |
| The three characters `%00` (sent as `%2500`; not a NUL byte) | 404 | 404 |
| A UUID in upper case | 404 | 404 |
| `x` × 101 (over `maxParamLength`) | 400 validation problem | 400 validation problem |
| `../../etc/passwd` (sent as `..%2F..%2Fetc%2Fpasswd`) | 405 `text/html` (nginx: normalised to `/etc/passwd`, served by `location /`) | 405 `text/html` (same) |
| `PATCH` body `{"__proto__":{"completed":true}}` | 400 validation problem | — |
| `PATCH` body `{"constructor":{"prototype":{"x":1}}}` | 400 validation problem | — |
| `PATCH` body `{"completed":true,"__proto__":{"description":"polluted"}}` | 400 validation problem | — |

Afterwards `GET /api/todos` answered 200 with the probe's todos unchanged ("probe target" still `completed: false` with its description), and `GET /api/health` answered 200. `GET /api/todos/%2e%2e/%2e%2e/etc/passwd` is normalised to `/etc/passwd` and answers the SPA's `index.html` (200), as any unknown path outside `/api` does. No file outside the web root is served (S9).

### Changed since epic 1's review (`e96a258`)

| Change | Review |
|---|---|
| `PATCH` and `DELETE /api/todos/{id}`, `UpdateTodoBody`, `TodoParams`, repository `update` and `remove` | Parameterised (above), strict validation, every error a fixed problem (AD-9). I4, I5, I8, I11 and I13 integration tests cover them on every run. `DELETE`'s `400` was not documented (S6). |
| Edit form, `TextField`, Delete confirm, announcements, Loading status | Text only (above, and the XSS probe). |
| `apps/web/nginx.conf`: `proxy_read_timeout 10s` | Bounds a stalled API: nginx answers the unavailable problem after 10 s (AD-4). Adds no exposure. The `stalled-api` profile test pins it. |
| `compose.yml`: `name: "${COMPOSE_PROJECT_NAME:?…}"` | A Compose command with no `-p` is refused, so a checkout named `todo` cannot act on production. A safety guard. It holds no secret and changes no published port. |
| `.env.example` | Comments only: the `name:` guard, and `APP_ENV` now required. Still no secret value. |
| `packages/contract/openapi.json` | Generated (AD-5), documents the new routes. |
| Dependencies, Dockerfiles, `.dockerignore`, `.github/workflows` | No change. |

### Containers and logs

| Check | Result |
|---|---|
| `api` user | `uid=1000(node) gid=1000(node)` |
| `web-test` user | `uid=101(nginx) gid=101(nginx)` |
| Images, secrets, ports, CORS | No Dockerfile, `.dockerignore`, port or nginx header change since epic 1, whose checks stand. Not re-probed. |
| Logs | After both probe runs: 130 and 238 api log lines, all info level. None holds a probe description (`pwned`, `DROP TABLE`, `OR 1=1`, `<img`, `svg`, `placeholder`, `probe target`, `polluted`, `typed`: 0 lines each). Request lines log the method and URL, so an injection id appears there percent-encoded (e.g. `/api/todos/1'%3B%20DROP%20TABLE%20todos%3B%20--`), as a URL, never a description (AD-17, S11). I13's integration tests (create, update and delete, refused or failed) and `logs.profile.test.ts` assert no todo text in any log line on every run. |

### Response headers

All seven AD-19 headers (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `Strict-Transport-Security`) were present on every todo-test response the API probe read, before and after the change, including nginx's new problem answers and its HTML 400 and 405 pages. `headers.profile.test.ts` and the contract suite assert them on every `pnpm test:all`. Production was not probed, by rule; its headers come from the same `nginx.conf`.

## Findings

| # | Severity | Finding | Status | Change or reason |
|---|---|---|---|---|
| S1 | low | `pnpm audit`: moderate advisory GHSA-67mh-4wv8-2f99 in `esbuild` ≤ 0.24.2, through `drizzle-kit`'s `@esbuild-kit` loader. Carried from epic 1. | accepted | Unchanged since epic 1: dev-only, in neither image, and drizzle-kit never starts esbuild's development server. Revisit when drizzle-kit drops `@esbuild-kit` (drizzle 1.0, deferred in the spine). |
| S2 | low | Plain `http://` to the production hostname is not redirected to HTTPS. Carried from epic 1 (its HSTS half was fixed there). | accepted | The redirect belongs at Cloudflare's edge ("Always Use HTTPS" for the zone), a dashboard setting outside the repository. It stays a hitl follow-up for the user. Not re-checked: this review sends no request to production. |
| S3 | low | nginx's own 413 (body over 1 MiB) and 400 (malformed percent-encoding) under `/api/` were HTML, not `application/problem+json` (AD-9). Epic 1's S3, backlog #28. | fixed | `apps/web/nginx.conf`: a server-level `error_page 400` and `location /api/`'s `error_page 400 413` go to `location = /api/_nginx/invalid-request`, which answers AD-9's validation problem byte for byte, status 400, `application/problem+json`, with the AD-19 headers, when the request line's path is under `/api/`, and nginx's own page anywhere else. `/api/_nginx/invalid-request` is a reserved path: nginx answers it and never forwards it, and requested directly it answers the validation problem. Pinned by `todos.contract.test.ts` (over-limit `POST`, `%zz` `GET`/`PATCH`/`DELETE`, and an invalid chunk size, which only `location /api/`'s own `error_page` sees; validated against openapi.json for `POST`, `PATCH` and `DELETE`) and `headers.profile.test.ts` (`GET /%zz` stays nginx's HTML 400). Fixed at the origin (nginx). What Cloudflare's edge sends in front of it for such requests is not verified, because this review sends no request to production. Like S2, that is a follow-up check. |
| S4 | info | The public hostname is unauthenticated and not rate-limited. Carried from epic 1. | accepted | The spine accepts both for v1 (Deferred: access control, rate limiting), by user decision. Edit and delete widen what an anonymous visitor can do to every todo, which that decision already covers. |
| S5 | info | Production todos are not backed up. Carried from epic 1. | accepted | The spine accepts this for v1 (Deferred: backups), by user decision. Delete now removes rows for good, which that decision already covers. |
| S6 | low | `DELETE /api/todos/{id}` answered an undocumented `400` (a JSON content type with an empty body, a malformed percent-encoding, an id over 100 characters). Left open by story 2.2's review. | fixed | `apps/api/src/routes/todos.ts` documents `400: problemResponses[400]` on `DELETE`, and `openapi.json` is regenerated. `openapi.test.ts` pins `['204','400','404','500','503']`, and `update-delete.test.ts` checks each case as a documented validation problem that deletes nothing and echoes no id. |
| S7 | info | Three `GET`s answer a `400` validation problem that no `GET` documents: the list URL with a bad escape (`/api/todos%E0%A4%A`: the API's problem in-process, nginx's through web-test, which refuses the escape itself); `GET /api/todos/%zz`, a `GET` of one todo, which is not a route and now answers nginx's 400; and `GET /api/todos` with a body over 1 MiB, now nginx's 400. | accepted | The list contract (`GET` and `POST /api/todos`) must not change in this story, and `GET` of one todo is no route to document. Each answer is AD-9's validation problem, so the client classifies it as `validation`, and each can only come from a hand-made request. The integration "malformed URLs" test and the contract test assert the bodies and headers. |
| S8 | info | `TodoParams`' comment said an id over `maxParamLength` (100) was answered 404 by the not-found handler. Fastify 5 refuses it with `FST_ERR_MAX_PARAM_LENGTH` (414), which the error handler answers as the validation problem (400). | fixed | The comment now says 400, the answer is documented for `PATCH` and (with S6) `DELETE`, and `update-delete.test.ts` pins it. No behaviour changed. |
| S9 | info | An id holding encoded `..%2F` segments is decoded and normalised by nginx before it picks a location, so `/api/todos/..%2F..%2Fx` leaves `/api/` and is answered by `location /`: `index.html` for `GET`, nginx's HTML 405 for `PATCH` and `DELETE`. | accepted | No file outside the web root is served, and the request never reaches the API. The client's ids are `crypto.randomUUID()` values, so it never sends one. Also keeping nginx's HTML under `/api/`, not covered by S3's fix: request lines nginx cannot parse at all (`$request` is then empty), absolute-form request targets (`GET http://host/api/...`), nginx's other own codes under `/api` (405, e.g. for `TRACE`; 411; 414; 431/494; 501), and an over-limit body sent to a path spelled otherwise (`//api/`, `/%61pi/`). All are accepted: neither the client nor the Cloudflare tunnel sends any of these. |
| S10 | info | The deploy job's secrets (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `TUNNEL_TOKEN`) are repository secrets, not secrets of a protected environment. Today only the `deploy` job, gated on `refs/heads/main`, reads them, but a workflow change on any branch could read them too. | to be fixed: entry 17 (#64) and the user's entry 18 (#65) | Decision: 2026-11-25, user. Entry 17 (#64) runs the deploy job in a `production` environment, limited to the `main` branch (`environment: production` on `deploy`). In entry 18 (#65) the user moves these secrets into that environment. Not built in this story, which changes no workflow or secret. |
| S11 | info | Request log lines carry the URL, so a client-chosen id (any string up to 100 characters) reaches the api logs, percent-encoded. | accepted | No description ever does (AD-17; I13's integration and profile tests), and an id is not todo text: the client mints UUIDs. Logging the URL is what makes a request traceable. |

No XSS or injection path was found in rendered or edited text, or on the update and delete routes. Payloads stay text in the card, the edit field, the `aria-label`s and the announcements, and the database binds every id and description. nginx's own 400 and 413 under `/api/` now answer AD-9's validation problem, and `DELETE` documents its `400`.

## Backlog decisions

- #26 — Decision: 2026-11-25, user: built in this epic as entry 15 (#26). Agreed design: a `schedule` trigger (e.g. every 30 min) whose first job reads the SHA production runs, as the deploy guard does, and runs `test` and `deploy` for main's tip only when the tip is newer. It covers a pending deploy replaced in the `deploy-prod` group, and also a merge with no push run at all: on 2026-11-25 a GitHub incident left merge commit ea86627 (PR #56) on main with no push run; it reached production only through the next merge's run, 45656662261 (0b883a5, PR #57). Until entry 15 ships: a cancelled tip deploy is re-run by hand; a tip with no run is deployed by the next push to main.
- #27 — Decision: 2026-11-25, user: built in this epic as entry 16 (#27). Agreed design: a job with `if: github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'` that fails with an `::error::` telling the person to choose `main` in "Use workflow from", so the run fails visibly instead of skipping every job.
- #28 — Decision: 2026-11-25, fixed in this story (nginx config only). nginx answers its own 400 and 413 under `/api/` with AD-9's validation problem (status 400, the API's own body for an invalid request, as the API also turns its own over-limit 413 into), with the AD-19 headers; paths outside `/api/` keep nginx's pages. The reserved path `/api/_nginx/invalid-request` is answered by nginx, never forwarded, and answers the validation problem if requested directly. Pinned by the contract and profile tests. Fixed at the origin; what Cloudflare's edge sends in front of it for such requests is not verified (no production probe) and is a follow-up check, like S2. The ticket can close when this merges. Not covered, keeping nginx's HTML: request lines nginx cannot parse at all (`$request` empty), absolute-form request targets (`GET http://host/api/...`), other nginx-own codes under `/api` (405 e.g. `TRACE`, 411, 414, 431/494, 501), and an over-limit body to a path spelled otherwise (`//api/`, `/%61pi/`). Accepted in the report (S9): the client and the tunnel send none of these.

## Note for the architect

AD-4 and AD-6 were amended on 2026-11-25 by the user's decision, outside this story, to match the code: this story did not edit the spine. Before that amendment, AD-4 described only nginx's unavailable problem, and AD-6's table listed no `400` for `DELETE`. What the amendment covers: nginx also answers its own 400 and 413 under `/api/` with the validation problem (S3); it answers one reserved path itself, `/api/_nginx/invalid-request`, which is never forwarded and answers the validation problem if requested directly, so not every `/api/*` path is forwarded unchanged; and `DELETE` documents `400` (S6).
