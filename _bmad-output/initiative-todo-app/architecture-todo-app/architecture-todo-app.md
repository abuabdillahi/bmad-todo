---
name: 'Todo App v1'
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: 'Layered three-tier (SPA → REST API → embedded SQLite), one schema-sourced contract at the seam'
scope: 'The whole Todo App v1 system — web client, API, storage, containers, environments, tests, CI and deployment — for epic-todo-foundation and epic-manage-todos'
status: final
created: '2026-11-23'
updated: '2026-11-23'
binds: [R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12]
sources: ['_bmad-output/initiative-todo-app/initiative-todo-app.md', '_bmad-output/initiative-todo-app/test-strategy.md', '_bmad-output/initiative-todo-app/notes-quality-infra.md']
---

# Architecture Spine — Todo App v1

## Design Paradigm

**Layered three-tier**: a React SPA, a REST API, and an embedded SQLite store. Each layer depends only on the layer below it. The **contract** (`packages/contract`) is the only thing the web and API tiers share. It holds the TypeBox schemas, which are the single source for both validation and types.

| Layer | Lives in | May depend on |
| --- | --- | --- |
| Web · components | `apps/web/src/components/` | Web · todos hooks, announcer |
| Web · todos hooks (server state) | `apps/web/src/todos/` | Web · API client, announcer |
| Web · API client | `apps/web/src/api/` | `packages/contract` (`import type` only) |
| API · routes (HTTP) | `apps/api/src/routes/` | API · service, `packages/contract` |
| API · service (domain rules) | `apps/api/src/todos/service.ts` | API · repository |
| API · repository and db (persistence) | `apps/api/src/todos/repository.ts`, `apps/api/src/db/` | Drizzle, SQLite |
| Contract | `packages/contract` | `typebox` only |

```mermaid
flowchart LR
  subgraph web["apps/web"]
    C[components] --> H[todos hooks]
    C --> AN[announcer]
    H --> AC[API client]
    H --> AN
  end
  subgraph api["apps/api"]
    R[routes] --> S[service]
    S --> RP[repository + db]
    RP --> DB[(SQLite)]
  end
  AC -. "HTTP /api" .-> R
  AC -- "import type" --> K[packages/contract]
  R --> K
  R -- "generates openapi.json" --> K
```

## Invariants & Rules

### AD-1 — The images that are tested are the images that run in production [ADOPTED]

- **Binds:** C6, C7, C11, C12, R16, R22
- **Prevents:** Dev, test and prod running different runtimes or artifacts, and a deploy that rebuilds what CI tested.
- **Rule:** Production runs the `api` and `web` images that CI built and tested for that git SHA, under the compose project `todo` on the Hetzner host, with the `prod` profile. No step after CI's test job builds an image. There is no Cloudflare runtime (no Workers, D1 or Containers). C12's Cloudflare hosting is replaced by this rule, and Cloudflare's only role is the ingress in AD-3.

### AD-2 — The API container is the only owner of the data [ADOPTED]

- **Binds:** R2, R10, R11, R12, C2
- **Prevents:** A second writer or reader of todo data, and lost data on restart.
- **Rule:** Todos live in one SQLite file at `DATABASE_PATH`, on the project's named `data` volume, which is mounted only into the API service. Exactly one API replica runs. No other service, script or container opens the file while the API runs. Production is never brought down with `down -v`.

### AD-3 — Public traffic enters through a Cloudflare Tunnel; production publishes no ports [ADOPTED]

- **Binds:** C7, R22
- **Prevents:** Host-port collisions on the shared host, and an origin certificate to place and rotate.
- **Rule:** In `prod`, a `cloudflared` service connects outbound to Cloudflare with `TUNNEL_TOKEN` and forwards the public hostname to `web:8080`. No `prod` service publishes a host port. Cloudflare terminates TLS. The hostname is public and unauthenticated in v1 (an accepted risk, see Deferred).

### AD-4 — The browser talks to one origin, and `/api` is never rewritten

- **Binds:** R10, R12, R20
- **Prevents:** CORS, prefix stripping by a proxy, a stale upstream after the API restarts, and HTML error pages reaching the client.
- **Rule:** The API registers every route under `/api` itself. The browser calls only relative `/api/*` paths. The web tier forwards `/api/*` to the API **with the path unchanged**: nginx in `test`/`prod`, and the Vite dev server proxy in `dev`. nginx resolves `api` per request through Docker DNS, so it never pins a stale IP. For `/api/*` it answers upstream failures (502, 503, 504) with an RFC 9457 problem (AD-9). The API enables no CORS and publishes no host port in any profile.

### AD-5 — One schema source; the contract is generated and committed

- **Binds:** C9, R10, R12, R17
- **Prevents:** Web and API disagreeing on a shape, and a contract that documents something other than what runs.
- **Rule:** Every request, response and problem schema is a TypeBox schema in `packages/contract`. API routes use those schemas, and the web gets types from them by `import type` only, never with hand-written API types. `@fastify/swagger`, set to `openapi: '3.1.0'`, generates `packages/contract/openapi.json`, which is committed. CI fails if regenerating it produces a diff. `apps/web/src/api/` is one hand-written, typed `fetch` client. It is the only web code that sends HTTP.

### AD-6 — API surface and status semantics [ADOPTED]

- **Binds:** R1, R3, R4, R5, R10, R13, R15
- **Prevents:** Epics choosing different verbs, paths or status codes, and a retry or double-submit being reported as a failure.
- **Rule:**

| Method & path | Body | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/todos` | — | `200` `Todo[]`, sorted by the server: `createdAt` desc, then `id` desc | — |
| `POST /api/todos` | `{ id, description }` | `201` new `Todo`; `200` stored `Todo` when the same `id` already exists with the same trimmed description (an idempotent replay) | `400`, `409` (same `id`, different content) |
| `PATCH /api/todos/{id}` | `{ description?, completed? }`, at least one | `200` full `Todo` | `400`, `404` |
| `DELETE /api/todos/{id}` | — | `204` | `404` |
| `GET /api/health` | — | `200 { "status": "ok" }` | `503` problem (`storage-unavailable`) |

There is no version prefix; a prefix comes only with a breaking change. There is no `PUT` and no bulk or reset endpoint.

### AD-7 — Todo shape and identity [ADOPTED]

- **Binds:** R1, R2, R4, R7, R13
- **Prevents:** Temporary-id handling in the client, and drifting field names, types and time formats.
- **Rule:** On the wire, a `Todo` is `{ id: string (UUID), description: string, completed: boolean, createdAt: string }`. **The client mints `id`** with `crypto.randomUUID()` before the mutation starts, and sends it on `POST`. The server sets `createdAt` (ISO-8601 UTC with milliseconds, e.g. `2026-11-23T21:33:00.000Z`) and sets `completed: false` on create. The repository alone converts between the wire format and storage.

### AD-8 — Strict validation: the server is the authority, and the client runs the same rule

- **Binds:** R1, R12, R13, U1, I2, I4, K1, K3
- **Prevents:** Create and edit applying different rules, client and server disagreeing on what's valid, and silent coercion of bad input.
- **Rule:** The API's Ajv runs with `coerceTypes: false` and `removeAdditional: false`. Every body schema has `additionalProperties: false`, and `null` is never valid. A `preValidation` step trims `description`. The schema then requires 1–200 **Unicode code points** on the trimmed value, on both create and edit, and that trimmed value is what gets stored. Before sending, the client runs the same check, trimming and then counting `[...s].length`. A failure renders **inline** next to its input via `aria-describedby`; field errors never go through the announcer. The client sends only the fields it is changing. A rejected request changes nothing.

### AD-9 — Errors are RFC 9457 Problem Details, with a closed set of types [ADOPTED]

- **Binds:** R7, R12, C9, I2, I5, I7, I9
- **Prevents:** Each route or epic inventing its own error shape, and each client parsing several shapes.
- **Rule:** Every non-2xx response under `/api` is `application/problem+json`: `{ type, title, status, detail, errors?: [{ field, message }] }`. `field` is the bare property name (e.g. `description`). `type` is one of the `/problems/{validation | not-found | conflict | storage-unavailable | internal}` URIs, which `packages/contract` defines from epic 1 onward together with the single `Problem` schema. One Fastify error handler produces every problem, and no problem contains a stack trace, SQL or todo text. The client treats a non-2xx response without a problem body, or a network error, as a generic failure.

### AD-10 — API layering

- **Binds:** R10, R12, R15, C3
- **Prevents:** Business rules and SQL scattered across route handlers.
- **Rule:** Routes parse the request, call the service, and map the result to a response. The service owns the domain rules (existence, idempotent replay, ordering) and imports nothing from Fastify. Only the repository and `src/db/` (connection and migrations) touch Drizzle or SQL. The health route calls `repository.ping()`. The app is built by `buildApp({ config, db })`, which receives its config and database handle.

### AD-11 — Web layering and list states

- **Binds:** R3, R7, R9, R12
- **Prevents:** Components fetching directly, and the list disappearing when a refetch fails in the background.
- **Rule:** Components read and change todos only through the hooks in `apps/web/src/todos/`. Only those hooks call the API client. The list uses one query key, `['todos']`, and renders the order the server returned, except that an optimistic add goes on top. The list shows its error state only when the query has errored **and** has no cached data. A failed refetch while data is cached keeps the list and goes to the announcer.

### AD-12 — The repository is the seam for owners later (C1)

- **Binds:** C1
- **Prevents:** A second data-access path that a future owner or auth change would miss, and a speculative column now.
- **Rule:** No `owner_id` column and no auth code in v1. Because every read and write goes through the repository (AD-10), adding owners later means a migration, a repository filter and an auth plugin. No existing route, service signature or wire field changes, though new fields may be added.

### AD-13 — One optimistic-mutation helper for every write

- **Binds:** R7, R12, U4, E6
- **Prevents:** Add, edit, complete and delete each inventing their own optimistic, rollback or race logic; one mutation's rollback or refetch overwriting another's change.
- **Rule:** Every todo mutation, including create, goes through one helper in `apps/web/src/todos/`. The helper:
  - cancels in-flight `['todos']` fetches, then applies the change to that one todo in the cache at once
  - sends a given todo's requests to the server in the order the user acted, so a `PATCH` or `DELETE` never overtakes its own todo's `POST`
  - on failure, reverts only that todo's change (it never restores a whole-list snapshot) and announces it (AD-14)
  - invalidates `['todos']` only when no todo mutation is still pending
  - retries nothing automatically
  
  A `404` on `DELETE` counts as success.

### AD-14 — One visible announcer for outcome messages

- **Binds:** R7, R9, R12, R14 (WCAG 4.1.3)
- **Prevents:** Each component rendering its own alert or toast, which leads to duplicated or missing screen-reader announcements and failures a sighted user never sees.
- **Rule:** One app-level region, visible on screen and marked `aria-live`, carries save-failure, refetch-failure and status messages. All wording comes from one module, `apps/web/src/todos/messages.ts`, keyed by problem `type` and by action, with a generic fallback. No component renders another toast or alert for a mutation outcome. Field validation is the exception and stays inline (AD-8).

### AD-15 — Writes are atomic, and the schema migrates forward at startup

- **Binds:** R11, R12, I2, I4, I6
- **Prevents:** Half-written todos, environments on different schemas, and two stories editing one migration.
- **Rule:** Each write request runs as one SQL statement or one transaction, and the repository returns the persisted row. Drizzle-kit migrations are committed and applied by the API at startup, before it listens. Every story that changes the schema adds a new migration. A merged migration is never edited, and migrations in v1 are additive only (new columns are nullable or defaulted).

### AD-16 — One compose file, three profiles, three project names, configuration from the environment

- **Binds:** C7, R16, R17, I6
- **Prevents:** Unwritable or forked compose files, a test reset wiping dev data, and configuration baked into images.
- **Rule:** One `compose.yml` holds every service. Profiles and services are fixed in the Structural Seed table, and every environment runs under its own project name: `todo-dev`, `todo-test`, `todo`. Built services use `image: ghcr.io/abuabdillahi/bmad-todo-{api,web}:${IMAGE_TAG:-local}` together with `build:`. `APP_ENV` is `development`, `test` or `production`. All configuration comes from environment variables named in `.env.example`. The API validates them at startup and exits non-zero if any is invalid. No code reads `APP_ENV` to change behaviour, except for log formatting.

### AD-17 — Every service is health-checked, restartable, and logs to stdout

- **Binds:** R15, I7, C6
- **Prevents:** Health checks that probe different things, services without a health signal, an app that stays down after a host reboot, and logs filling the host's disk.
- **Rule:** Every compose service in every profile has a health check that uses only a binary already in its image:
  - `api`: Node fetching `/api/health`
  - `web` and `web-test`: `wget` fetching `/healthz`
  - `web-dev`: Node fetching the Vite port
  - `cloudflared`: `cloudflared tunnel --metrics 127.0.0.1:2000 ready`
  
  Services start behind `depends_on: condition: service_healthy`. Services in `test` and `prod` use `restart: unless-stopped`. Every service logs only to stdout and stderr through the `json-file` driver, with `max-size`/`max-file` rotation. The API logs JSON through pino with a request id.

### AD-18 — Delivery: one workflow that builds once, tests, then deploys from a green `main`

- **Binds:** R21, R22, C11
- **Prevents:** Untested images reaching production, out-of-order deploys, and deploys or rollbacks that need a person to finish them.
- **Rule:** One GitHub Actions workflow runs on every push:
  1. The **`test`** job builds both images tagged `<git-sha>` and runs `pnpm test:all` against them in `todo-test`. Its result shows on the commit.
  2. The **`deploy`** job (`needs: test`, `main` only, concurrency group `deploy-prod`, not cancelled in progress) pushes those same tags to GHCR. It then copies `compose.yml` at that SHA to the host over SSH, writes `IMAGE_TAG` into the host `.env`, runs `docker compose -p todo --profile prod pull` and `up -d --wait`, and checks that the public `/api/health` returns `200`. Any failure fails the workflow.
  
  Rollback is the same deploy run by hand (`workflow_dispatch`) with an earlier SHA.

### AD-19 — Security baseline

- **Binds:** R20, I8, C6
- **Prevents:** XSS, injection and secret leaks coming in through one epic's shortcut.
- **Rule:**
  - Todo text renders only through React's escaping. No `dangerouslySetInnerHTML` anywhere.
  - SQL goes only through Drizzle's parameterized queries.
  - nginx sends a strict `Content-Security-Policy` (`default-src 'self'`) and the standard security headers.
  - Images run as a non-root user.
  - Images, `compose.yml` and the repo hold no secrets. Production secrets live in GitHub Actions secrets and in the host's `.env`, which the deploy writes.
  - Logs never contain todo text at `info` level or below.

### AD-20 — Test harness: where each layer runs and how it fails things

- **Binds:** R14, R17, R18, R19, C8, C9, C10, I1–I9, K1–K6, E1–E8
- **Prevents:** Epics building incompatible test setups: suites racing over one shared list, test-only switches in app code, coverage that can't be split by layer, and C9 resting on a manual tool.
- **Rule:**
  - **Unit and integration** tests run in-process through `buildApp`, on a temp SQLite file per test file with the committed migrations. I7's unhealthy case closes the db handle.
  - **Component** tests use Testing Library with MSW as the only HTTP stub. They never mock the hooks.
  - **Contract, I6 and e2e** tests run against `todo-test`, reaching the API only through `web-test`'s origin (`E2E_BASE_URL`). The contract suite validates every response against `openapi.json` with `Ajv2020` and `ajv-formats`. That suite is C9's "equivalent". Postman MCP, Playwright MCP and Chrome DevTools MCP are agent-side tools for development and debugging, never CI dependencies.
  - **E2e** runs with `workers: 1`. Each test empties the list through the public API in `beforeEach`. Failures are injected only with Playwright `page.route` (a problem response for "failing", `abort` for "unreachable"). App code has no test-only routes or flags.
  - **axe-core** runs in every e2e test with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`.
  - **Vitest** has one project per layer (`unit`, `component`, `integration`). Coverage is reported per project, and container-run suites report coverage by scenario id.
  - **At each epic's close,** Lighthouse and the C4 performance profile run against `todo-test`. API p95 comes from at least 100 requests per endpoint.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Naming | camelCase for JSON keys and TS identifiers; snake_case for SQL tables and columns (`todos`, `created_at`); PascalCase for React component files; kebab-case for other files |
| Ids and time | UUID strings (AD-7). `createdAt` is ISO-8601 UTC with milliseconds on the wire and epoch-ms `integer` in storage, converted only in the repository |
| Ports and env names | API listens on `PORT=3000`, nginx on `8080`, Vite on `5173`. `web-test` publishes `127.0.0.1:${TEST_WEB_PORT:-8081}` and `web-dev` publishes `127.0.0.1:5173`. Variables: `APP_ENV`, `PORT`, `DATABASE_PATH=/data/todos.db`, `LOG_LEVEL`, `IMAGE_TAG`, `TUNNEL_TOKEN`, `E2E_BASE_URL` |
| Errors | RFC 9457 with closed `type` URIs (AD-9). The client maps them through `messages.ts` (AD-14) |
| Styling | CSS Modules plus CSS custom-property tokens from the `bmad-ux` DESIGN.md. No CSS framework or CSS-in-JS |
| Accessibility | Native elements first (a checkbox for completion, buttons for actions, a form for add/edit), every control keyboard-operable with a visible focus ring, and WCAG 2.2 AA (R14) |
| Tests | Unit tests are `*.test.ts(x)` and component tests `*.component.test.tsx`, both beside the code. Integration tests are in `apps/api/test/integration/`, contract tests in `apps/api/test/contract/`, e2e tests in `e2e/`. Test titles start with their scenario id (U/I/K/E) |
| One command | `pnpm test:all` brings up `todo-test`, runs every layer, writes coverage, and tears the project down |
| Toolchain | `packageManager: pnpm@12.23.0`. Dockerfiles install pnpm with `npm i -g pnpm@12.23.0` (Node 26 has no corepack) and CI uses `pnpm/action-setup`. `allowBuilds` lists `esbuild`. The TS configs list `types` explicitly (`node`, `vitest/globals`) |
| Reports | `docs/quality/<yyyy-mm-dd>-<epic>-<report>.md` (test-strategy Reports) |

## Stack

| Name | Version |
| --- | --- |
| Node.js (Active LTS) | 26.13.1 |
| pnpm | 12.23.0 |
| TypeScript | 6.0.3 |
| @types/node | 26.6.6 |
| Fastify | 5.12.8 |
| @fastify/swagger | 9.9.5 |
| @fastify/type-provider-typebox | 6.3.0 |
| typebox | 1.4.7 |
| ajv-formats | 3.0.1 |
| better-sqlite3 | 13.2.0 |
| @types/better-sqlite3 | 9.6.0 |
| drizzle-orm | 0.45.4 |
| drizzle-kit | 0.31.11 |
| React | 19.3.1 |
| Vite | 8.3.8 |
| @vitejs/plugin-react | 6.3.0 |
| @tanstack/react-query | 5.108.4 |
| Vitest + @vitest/coverage-v8 | 5.1.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/dom | 10.4.2 |
| @testing-library/user-event | 14.6.13 |
| jsdom | 31.0.1 |
| MSW | 3.0.7 |
| Ajv (Ajv2020) | 8.20.0 |
| @playwright/test | 1.65.1 |
| @axe-core/playwright | 4.14.0 |
| nginx/nginx-unprivileged | 1.30-alpine |
| cloudflare/cloudflared | 2026.11.2 |

## Structural Seed

### Environments and deployment

```mermaid
flowchart TB
  subgraph gh["GitHub Actions · one workflow"]
    push[push] --> test["test job: build :sha,<br/>pnpm test:all on todo-test"]
    test -- "green main" --> deploy["deploy job: push :sha to GHCR,<br/>copy compose.yml, write IMAGE_TAG"]
  end
  subgraph host["Hetzner host"]
    subgraph todo["compose project todo · profile prod"]
      cfd[cloudflared] --> web["web · nginx :8080"]
      web -- "/api/* unchanged" --> api["api · Fastify :3000"]
      api --> vol[("volume data<br/>SQLite")]
    end
  end
  user((Browser)) --> cf["Cloudflare edge · TLS"]
  cf -- tunnel --> cfd
  deploy -- "ssh: pull, up -d --wait, health check" --> todo
```

| Profile | Project | Services | Host ports |
| --- | --- | --- | --- |
| `dev` | `todo-dev` | `web-dev` (Vite + HMR), `api-dev` (watch mode, source mounted, network alias `api`) | `127.0.0.1:5173` |
| `test` | `todo-test` | `api`, `web-test` (`extends: web`) — built images; volume removed on teardown | `127.0.0.1:${TEST_WEB_PORT:-8081}` |
| `prod` | `todo` | `api`, `web`, `cloudflared` — GHCR images at `IMAGE_TAG` | none |

### Data

```mermaid
erDiagram
  TODOS {
    text id PK "UUID, client-minted"
    text description "trimmed, 1-200 code points"
    integer completed "0 or 1"
    integer created_at "epoch ms, server-set"
  }
```

### Source tree

```text
/
  compose.yml              # every service and profile (AD-16)
  .env.example             # every variable, no values for secrets
  .github/workflows/ci.yml # test → deploy (AD-18)
  apps/
    api/                   # Fastify; Dockerfile (multi-stage, non-root)
      src/routes/  src/todos/{service,repository}.ts  src/db/  drizzle/
      test/integration/  test/contract/
    web/                   # React + Vite; Dockerfile (build → nginx-unprivileged)
      src/api/  src/todos/{hooks,mutation helper,messages.ts}  src/components/  nginx.conf
  packages/contract/       # TypeBox schemas, Problem types, openapi.json (generated, committed)
  e2e/                     # Playwright + axe-core
  docs/quality/            # coverage, performance, accessibility and security reports
  README.md                # run, test, read logs, deploy, roll back, extend
```

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| R1, R13 create and edit text | `web/todos`, API `POST`/`PATCH` | AD-6, AD-7, AD-8, AD-13 |
| R2 todo fields | contract, `todos` table | AD-5, AD-7 |
| R3 list on open, R9 empty, loading and error states | `web/todos`, components | AD-6, AD-11, AD-14 |
| R4 complete and reactivate | `PATCH { completed }` | AD-6, AD-13 |
| R5 immediate delete | `DELETE` | AD-6, AD-13 |
| R6, R8 visual distinction, responsive | web components | `bmad-ux` DESIGN.md / EXPERIENCE.md; Conventions (Styling) |
| R7 instant, with revert | todos hooks | AD-13, AD-14 |
| R10 API | `apps/api` | AD-4, AD-5, AD-6, AD-10 |
| R11 persistence | SQLite volume | AD-2, AD-15, AD-17 (restart) |
| R12 invalid input, atomic writes, failures | contract, service, error handler, hooks | AD-8, AD-9, AD-11, AD-13, AD-15 |
| R14 WCAG 2.2 AA | web, e2e | AD-8, AD-14, AD-20, Conventions (Accessibility) |
| R15 health and logs | every service | AD-10, AD-17 |
| R16 environments | `compose.yml` | AD-16 |
| R17 suites, R18 coverage | Vitest projects, Playwright, `pnpm test:all` | AD-20, Conventions (Tests, One command) |
| R19 performance | `docs/quality`, `todo-test` | AD-20; C4 targets |
| R20 security | everywhere | AD-4, AD-8, AD-19 |
| R21, R22 CI and deploy | `.github/workflows/ci.yml` | AD-1, AD-18 |
| C1 owners later | repository | AD-12 |
| C2 server-side storage | API + SQLite | AD-2 |
| C3 simplicity | whole system | Paradigm, AD-10, AD-11 |
| C4 100 ms UI / 300 ms p95 | hooks, API | AD-13, AD-20 |
| C5 scope | — | Deferred |
| C6 hardened images, C7 compose | Dockerfiles, `compose.yml` | AD-16, AD-17, AD-19 |
| C8 tests from the tracer story onward | test harness | AD-20 |
| C9 machine-readable contract | `packages/contract` | AD-5, AD-9, AD-20 |
| C10 tooling | e2e, agent-side MCPs | AD-20 |
| C11 GitHub | Actions | AD-18 |
| C12 Cloudflare | ingress only | AD-1, AD-3 |

## Deferred

- **Access control on the public hostname:** accepted risk in v1, by user decision. Anyone with the URL can read and change the shared list. Revisit before the URL is shared beyond the team, or with C1's auth.
- **Backups of the SQLite volume:** out of v1, by user decision. Revisit before any real user relies on the deployed list, or if host-level snapshots turn out to be absent.
- **Visual design, layout, breakpoints, completion styling (R6, R8):** owned by a `bmad-ux` run (DESIGN.md + EXPERIENCE.md) before epic 1's UI stories. The spine fixes only the styling technology, the announcer and the data path.
- **Authentication, owners and multi-user:** out of v1 (C1). The seam is AD-12.
- **API versioning:** the first breaking change introduces a prefix (AD-6).
- **Horizontal scaling or Postgres:** single replica by AD-2. Revisit only if v2 needs concurrent writers. The move goes through the repository (AD-12).
- **Public hostname, tunnel token, SSH key, GHCR read token on the host:** hitl setup in epic-todo-foundation. Their names go in `.env.example` and the workflow, never their values.
- **Monitoring, alerting, uptime checks:** out of v1, beyond `docker compose logs` and the post-deploy health check.
- **Rate limiting and abuse protection:** out of v1. Revisit with access control.
- **TypeScript 7:** pinned to 6.0.3 until typescript-eslint supports it.
- **drizzle 1.0 and Fastify 6:** stay on 0.45/0.31 and 5.x until they are stable. drizzle 1.0 changes the migration layout.
- **Performance tuning:** measure against C4 first (R19). Indexes or caching only if a measurement calls for them.
