# Security report: epic-todo-foundation

- **Date:** 2026-11-25
- **Epic:** epic-todo-foundation (R20, AD-4, AD-8, AD-19)
- **Commit measured:** `b410ca9` plus story 1.9's changes (`apps/web/nginx.conf`: HSTS and cache headers; `apps/api/test/profile/headers.profile.test.ts` now also asserts HSTS)
- **Environment:** Probes ran on `todo-test` at `http://127.0.0.1:8081`. Production (`https://bmad-todo.abuabdillahi.com`) got only `GET` requests, to read response headers and `/api/health`.
- **Tools:** pnpm 12.23.0 `pnpm audit` (npm advisory database, queried 2026-11-25), `git grep`, curl, Node 26.13.1 `fetch`, Playwright 1.65.1 with Chromium 159.0.8154.6, Docker 29.9.3 with Compose v5.7.1
- **Reproduce:**
  - `pnpm audit --prod` and `pnpm audit`
  - The grep for unsafe patterns:

    ```sh
    git grep -n -E 'dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|sql\.raw|sql`[^`]*\$\{' -- apps packages e2e scripts
    ```

  - With `todo-test` up: `docker compose -p todo-test --profile test exec api id`, `… exec web-test id`, `docker image inspect` / `docker history --no-trunc` for both images, a `find` for `.env*`, keys and `.git` inside each container, `docker compose -p todo-test --profile test logs api`, and `curl -D -` against the routes listed below
  - The injection probe: five payloads `POST`ed to `/api/todos`, read back with `GET /api/todos`, then the page loaded in Chromium and one payload typed into the add form. The probe script was a one-off and is not committed. I8's integration tests (`apps/api/test/integration/todos.test.ts`, "injection payloads are inert text") cover the API half on every run.

## Results

### Dependencies

| Command | Result |
|---|---|
| `pnpm audit --prod` | No known vulnerabilities |
| `pnpm audit` (dev included) | 1 moderate: GHSA-67mh-4wv8-2f99, `esbuild` ≤ 0.24.2, path `apps__api > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` (S1) |

### Code: XSS and injection

- `git grep` finds no `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `sql.raw` or interpolated `sql` template in `apps`, `packages`, `e2e` or `scripts`.
- `apps/web/src/components/TodoCard.tsx` renders the description as a React text child (`{todo.description}`), so React escapes it (AD-19).
- `apps/api/src/todos/repository.ts` uses only Drizzle's query builder (`select`, `insert … values`, `eq`, `desc`), which binds parameters. Its one raw template is the constant ``sql`select 1` `` for the health ping.
- Validation is strict (AD-8): `coerceTypes: false`, `removeAdditional: false`, `additionalProperties: false` and the description pattern. Malformed JSON, a `text/plain` body and a body over nginx's 1 MiB limit are all refused (400, 400, 413).

### Injection probe on todo-test

| Payload (each with a unique suffix) | `POST` | Stored and returned | Rendered in Chromium |
|---|---|---|---|
| `'; DROP TABLE todos; --` | 201 | verbatim | as text |
| `" OR 1=1 --` | 201 | verbatim | as text |
| `<script>window.__pwned=1</script>` | 201 | verbatim | as text |
| `<img src=x onerror="window.__pwned=2">` | 201 | verbatim | as text |
| `{{constructor.constructor('window.__pwned=3')()}}` | 201 | verbatim | as text |
| `<img src=x onerror="window.__pwned=4">`, typed into the add form | optimistic, then 201 | verbatim | as text |

In the page, the cards' text equals the payloads exactly. The list holds no `script` or `img` element, `window.__pwned` stays unset, no dialog opens, and the console shows no error. The `todos` table still exists and `GET /api/todos` kept working for the rest of the session.

### Containers and configuration

| Check | Result |
|---|---|
| `api` user | `uid=1000(node)`. Image `User` is `node`, and `/app` is owned by root and read-only to the app user. |
| `web-test` user | `uid=101(nginx)` (`nginx-unprivileged`, listens on 8080) |
| Secrets in images | `docker history` shows no secret, token or `.env` step. `find` in both containers finds no `.env*`, private key, `.npmrc` or `.git`, only the Alpine CA bundle in `web`. `.dockerignore` excludes `.env`, `.git`, `**/*.db`, `.claude`, `.agents`, `_bmad` and `_bmad-output`. The image environments hold only `PATH`, `NODE_ENV` and nginx versions. |
| Secrets in compose | `compose.yml` holds no secret value. `TUNNEL_TOKEN` is `${TUNNEL_TOKEN:-}`, written to the host `.env` (mode 600) by each deploy from a GitHub secret (AD-19). `.env.example` names it with no value. |
| Published ports | `test`: only `127.0.0.1:8081`. `prod`: none (`docker compose -p todo --profile prod config` lists no `published`). The API publishes no host port in any profile (AD-4). |
| CORS | `GET /api/todos` with `Origin: https://evil.example` returns 200 and no `Access-Control-Allow-*` header. A preflight `OPTIONS` returns 404 `application/problem+json` with no CORS header. The browser talks to one origin (AD-4). |
| Logs | 1,562 info-level api log lines after the probes and the perf runs (`incoming request`, `request completed`, startup). None holds any probe payload or todo description. Request lines log only method, URL, host, address and a UUID `reqId` (AD-17, AD-19). The `profile` suite asserts this on every `pnpm test:all`. |
| Error bodies | Problem details carry no stack, SQL or todo text (AD-9). I2 and I11 assert this on every run. |

### Response headers

| Header | todo-test `/`, `/assets/*`, `/api/health` | Production `/`, `/assets/*`, `/api/health` (GET) |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'` | same |
| `X-Content-Type-Options` | `nosniff` | same |
| `X-Frame-Options` | `DENY` | same |
| `Referrer-Policy` | `no-referrer` | same |
| `Cross-Origin-Opener-Policy` | `same-origin` | same |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | same |
| `Strict-Transport-Security` | `max-age=31536000` (after S2's fix) | absent before this story's deploy (S2) |
| `Server` | `nginx`, no version (`server_tokens off`) | `cloudflare` |

## Findings

| # | Severity | Finding | Status | Change or reason |
|---|---|---|---|---|
| S1 | low | `pnpm audit`: moderate advisory GHSA-67mh-4wv8-2f99 in `esbuild` ≤ 0.24.2, through `drizzle-kit`'s `@esbuild-kit` loader. | accepted | A dev-only dependency. It is not in either image: the api image installs `--prod`, and the web image ships only nginx and static files. The advisory concerns esbuild's development server (`esbuild serve`), which drizzle-kit never starts: it uses esbuild only to load `drizzle.config.ts`. Overriding esbuild to ≥ 0.25 across `@esbuild-kit/core-utils`'s pinned 0.18 range risks breaking `db:generate`. Revisit when drizzle-kit drops `@esbuild-kit` (drizzle 1.0, deferred in the spine). |
| S2 | low | No `Strict-Transport-Security` header. Production also answers plain `http://bmad-todo.abuabdillahi.com/` with the app (200, no redirect to HTTPS), so a first visit over HTTP is not upgraded. | fixed (header) / accepted (redirect) | `apps/web/nginx.conf` now sends `Strict-Transport-Security: max-age=31536000` on every response. It has no `includeSubDomains`, so it covers this hostname only. Browsers honour it only over HTTPS, so production's HTTPS visits pin the host, and the plain-HTTP test origin ignores it. `headers.profile.test.ts` asserts it, and `pnpm test:all` passed. It reaches production with this story's merge to `main`. The redirect of plain HTTP belongs at Cloudflare's edge: turn on "Always Use HTTPS" for the zone, a dashboard setting outside the repository. It is accepted as a hitl follow-up, because nothing in the repo can set it and the origin cannot see the visitor's scheme reliably. |
| S3 | low | A request body over 1 MiB gets nginx's HTML 413, and a malformed percent-encoding in the path gets nginx's HTML 400, not `application/problem+json` (AD-9). | accepted | Neither can come from the app: the client sends at most 200 code points and builds only fixed paths. The client classifies such a response as `generic` (AD-9) and reports a failure, so nothing breaks. The API's own malformed-URL handling is a problem (integration "malformed URLs"). |
| S4 | info | The public hostname is unauthenticated and not rate-limited. | accepted | The spine accepts both for v1 (Deferred: access control, rate limiting), by user decision. |
| S5 | info | Production todos are not backed up. | accepted | The spine accepts this for v1 (Deferred: backups), by user decision. |

No XSS or injection path was found. The containers run as non-root with no secrets inside, the API sends no CORS headers, and logs hold no todo text. The one dependency advisory is dev-only and accepted. The missing HSTS header is fixed in this story.
