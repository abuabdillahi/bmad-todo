# BMad Todos

A single shared todo list in the browser. You add a todo and it shows at once. It is saved on the server and still there after a reload. Three parts:

- `apps/web`: a React single-page app.
- `apps/api`: a Fastify REST API under `/api`, which stores todos in one SQLite file.
- `packages/contract`: the TypeBox schemas, shared by web and API, and the generated `openapi.json`.

Everything runs in Docker Compose: one `compose.yml` with three profiles, `dev`, `test` and `prod`. Production runs on a Hetzner host behind a Cloudflare Tunnel and is deployed by GitHub Actions.

The design is in `_bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md`, cited below as AD-n, and the test plan is in `_bmad-output/initiative-todo-app/test-strategy.md`.

## Prerequisites

- **Node.js 26.13.1**, the version in `.nvmrc`. With nvm: `nvm install && nvm use`.
- **pnpm 12.23.0**: `npm i -g pnpm@12.23.0`. Node 26 has no corepack.
- **Docker Engine 25 or later and Docker Compose 2.24.4 or later** (`docker version`, `docker compose version`), with the daemon running. `compose.yml` needs them: the `profiles: !override` on `web-test` and `api-dev` needs Compose 2.24.4, and the health checks' `start_interval` needs Engine 25.
- **Free local ports:** `127.0.0.1:5173` (dev) and `127.0.0.1:8081` (test). To move the test port, set `TEST_WEB_PORT`: `pnpm test:all` derives `E2E_BASE_URL` from it. The measurement scripts read `BASE_URL` instead (default `http://127.0.0.1:8081`).

## Install

```sh
git clone https://github.com/abuabdillahi/bmad-todo.git
cd bmad-todo
pnpm install --frozen-lockfile
```

You need no `.env` to run locally. `.env.example` lists every variable the app, compose and CI read, with its default. The measurement scripts' own variables (`BASE_URL`, `PERF_*`) are documented at the top of each script.

## Run

Each environment runs under its own compose project name, so they never share containers or data, and both can run at once. Every `docker compose` command needs its `-p`: one with no `-p` (and no `COMPOSE_PROJECT_NAME`) is refused before it does anything, so it can never act on production's project `todo`.

### Dev: hot reload on http://127.0.0.1:5173

```sh
docker compose -p todo-dev --profile dev up -d --build --wait
```

- `web-dev` is Vite with hot module reload. It proxies `/api/*` to the API with the path unchanged.
- `api-dev` runs the API with `node --watch`.
- Both mount the source read-only from `apps/web/src`, `apps/api/src`, `packages/contract/src` and `apps/api/drizzle`, so an edit there reloads without a rebuild. After changing dependencies or a Dockerfile, run the `up` command again (it rebuilds).
- If your editor saves by renaming a temp file (vim, JetBrains "safe write"), changes to `index.html` or `vite.config.ts` are not picked up. Run `docker compose -p todo-dev up -d --force-recreate web-dev`.
- Dev todos live in the `todo-dev_data` volume and survive restarts.

Stop it with `docker compose -p todo-dev --profile dev down`. That keeps your dev todos. Add `-v` to delete them as well.

### Test: the production images on http://127.0.0.1:8081

```sh
docker compose -p todo-test --profile test up -d --build --wait
```

This builds and runs the same `api` and `web` images that production runs: nginx serves the built app and forwards `/api/*`.

Tear it down with its data:

```sh
docker compose -p todo-test --profile test down -v
```

`docker compose -p <project> ps` shows each container's health. `--wait` returns only once every container is healthy.

## Test

| Command | What it runs | Needs |
|---|---|---|
| `pnpm test` | Unit, component and integration suites (Vitest), in-process | Node only |
| `pnpm typecheck` | TypeScript across the workspace | Node only |
| `pnpm test:all` | Every layer: starts `todo-test` on a fresh volume, runs unit, component and integration with coverage, then contract, e2e (Playwright, installs Chromium on first run), the axe coverage check, the profile checks (restart, logs, headers, a stalled API answered within about 10 s and its create stored once) and the API-down contract, and always tears `todo-test` down | Docker, port 8081 free |

`pnpm test:all` exits 0 only if every step passed, and prints a summary. It resets a `todo-test` you already have running.

Coverage is written to `coverage/` (git-ignored, emptied at the start of each `pnpm test:all`):

- `coverage/{unit,component,integration}/`: line and branch coverage per Vitest project. Open `index.html` in each.
- `coverage/scenarios.md`: every test by scenario id (U/I/K/E from the test strategy) across all suites.

Test titles start with their scenario ids, and new tests should do the same. To run one Vitest project: `pnpm exec vitest run --project component`. To run e2e by hand against a running `todo-test`: `pnpm --filter @todo/e2e exec playwright test`.

Every e2e test must call `expectNoAxeViolations(page, '<state>')` from `e2e/axe.ts` at least once, at each key state it reaches. Give each state a label no other test uses. The `axe coverage` step (`scripts/axe-coverage.mjs`) reads the e2e report after the e2e step, and fails `pnpm test:all` if a passed test ran no scan in any project. To check a report by hand: `node scripts/axe-coverage.mjs [coverage/e2e-report.json]`.

### Measurements (at each epic's close)

Run these against a running `todo-test`. They are for local stacks only, and `perf:api` and `perf:first-load` create todos, so each refuses any host other than `127.0.0.1` or `localhost`. `perf:first-load` and `perf:lighthouse` need Playwright's Chromium. `pnpm test:all` installs it, or you can install it with `pnpm --filter @todo/e2e exec playwright install chromium`.

- `pnpm perf:api`: one-user API timing, at least 100 sequential requests per endpoint. It prints p50, p95, p99 and max, and fails if any p95 is 300 ms or more (C4).
- `pnpm perf:first-load`: first load and the add action, profiled in Chromium (Playwright and CDP), over 5 cold-cache runs on a seeded list.
- `pnpm perf:lighthouse`: Lighthouse (accessibility, best practices, performance) on mobile and desktop, in light and dark. Reports go to `coverage/lighthouse/`. It fails on any accessibility audit failure.

Start a fresh stack, run `pnpm --filter @todo/e2e exec playwright install chromium`, then run `perf:first-load` first (it seeds the list to 50), then the other two, then `down -v`. The dated reports in [`docs/quality/`](docs/quality/) record the results and every finding.

## Logs and health

Every service logs to stdout through Docker's `json-file` driver, rotated at 3 × 10 MB. The API logs JSON through pino. Each request writes two lines at `info`, with the same UUID `reqId`: `incoming request`, with the method, URL, host and client address, then `request completed`, with the status code and response time (`request errored`, at `error`, if sending the response fails). Neither holds the request or response body. A request that fails with a 503 or 500 also logs a third line with the same `reqId` and the error: `service unavailable` at `warn` or `unhandled error` at `error`. The `logs` profile test proves, at `LOG_LEVEL=info`, that a successful create, list, update and delete leave no todo text in the `api` logs. The `logs` integration test, running the real API process, proves the same for a create refused for validation, one refused as a conflict, and one that fails on storage; for an update that succeeds, one refused for validation, one to an unknown id, and one that fails on storage; and for a delete that succeeds and one that fails on storage.

```sh
docker compose -p todo-dev logs -f api-dev         # dev API (LOG_LEVEL debug)
docker compose -p todo-dev logs -f web-dev         # Vite
docker compose -p todo-test logs -f api web-test   # test
docker compose -p todo-test ps                     # health of each container
curl http://127.0.0.1:8081/api/health              # {"status":"ok"}, or a 503 problem
```

`GET /api/health` answers `200 {"status":"ok"}` when storage is reachable, and otherwise a `503` problem. On the production host, run the same commands from `~/todo` with `-p todo --profile prod`, for example `docker compose -p todo --profile prod logs -f api`.

## Deploy

Merge to `main` by pull request. Every push to `main` deploys. Work on a feature branch: every branch push runs the tests too, but only `main` deploys.

One workflow, `.github/workflows/ci.yml`, runs on every push:

1. **`test`** installs, typechecks, checks that `packages/contract/openapi.json` is regenerated and committed, then builds both images tagged with the commit SHA and runs `pnpm test:all` against them. On `main` it saves those exact images as a workflow artifact, kept for one day.
2. **`deploy`** runs on `main` only, after a green `test`, one deploy at a time. It downloads that artifact and pushes the tested images to GHCR as `ghcr.io/abuabdillahi/bmad-todo-{api,web}:<sha>`. It then connects to the host over SSH, copies `compose.yml`, and rewrites `~/todo/.env` (mode 600) from GitHub secrets with `IMAGE_TAG=<sha>`. It logs the host into GHCR only for the pull, runs `docker compose -p todo --profile prod up -d --wait`, and checks that `https://$PUBLIC_HOSTNAME/api/health` answers `{"status":"ok"}`. If a newer SHA is already live, it skips. No step after `test` builds an image.

Never run `down -v` on production (project `todo`): it deletes the todos.

**"Re-run failed jobs" on a failed deploy works for one day only.** It re-runs `deploy` as the same push, so it downloads the tested images from the run's artifact again. The artifact is kept for one day (`retention-days: 1`), so after that the re-run fails at "Download the tested images", unless a newer SHA is already live, in which case it skips. Do this instead:

- First check what is live. If a newer commit on `main` has deployed since, it already holds the failed commit's change, so do nothing. A run by hand has no newer-SHA check and would roll production back.
- If the failed run passed "Push the tested images to GHCR", that SHA's images are in GHCR even though it never deployed: deploy it by hand with the steps in [Roll back](#roll-back), setting `sha` to the failed commit.
- Otherwise its images were never pushed: merge a new commit to `main` by pull request. Its own run tests, saves and deploys it.

### Required GitHub settings (names only, values never in the repo)

| Kind | Name | What |
|---|---|---|
| secret | `DEPLOY_SSH_KEY` | Private SSH key of the host's deploy user |
| secret | `DEPLOY_KNOWN_HOSTS` | The host's `known_hosts` line(s), for strict host-key checking |
| secret | `DEPLOY_HOST` | The Hetzner host's address |
| secret | `DEPLOY_USER` | The deploy user on that host |
| secret | `TUNNEL_TOKEN` | The Cloudflare Tunnel token |
| variable | `PUBLIC_HOSTNAME` | The public hostname, for the post-deploy health check |

Also: Actions must be enabled, with workflow permissions that allow `packages: write`. The repository's default branch must be `main`, so rollback by hand works.

### One-time bootstrap (a person does this once)

- **Hetzner host:** Docker Engine 25 or later with the compose plugin 2.24.4 or later, since the deploy runs the same `compose.yml`; a deploy user allowed to run `docker`, with the public half of `DEPLOY_SSH_KEY` in its `~/.ssh/authorized_keys`; no existing compose project named `todo`. The deploy creates `~/todo` itself. The host keeps no registry credential.
- **Cloudflare:** a token-run Cloudflare Tunnel that routes the public hostname to `http://web:8080`, the hostname's DNS record, and the tunnel token stored as the `TUNNEL_TOKEN` secret. Production publishes no ports: `cloudflared` is the only way in. Also turn on SSL/TLS › Edge Certificates › **Always Use HTTPS** for the zone, so plain-HTTP visits are redirected (security report S2).

## Roll back

Roll back by running the same deploy by hand with an earlier SHA:

1. GitHub › Actions › **CI** › **Run workflow**, branch `main`.
2. Set `sha` to an earlier commit on `main` that was deployed before, so its images are in GHCR.
3. Run it. The workflow skips the test job and the one-day artifact, pulls that SHA's images from GHCR, deploys them with that SHA's `compose.yml`, and checks the public health endpoint. So a rollback by hand still works long after that SHA's test run.

With the `gh` CLI: `gh workflow run ci.yml --ref main -f sha=<earlier-sha>`. The data volume is untouched. Migrations only add (AD-15), which keeps an older API compatible with the newer schema.

## Extend

The layers and their rules are fixed in the architecture spine. In short:

- **API (AD-10):** a route in `apps/api/src/routes/` parses the request and calls the service. The service in `apps/api/src/todos/service.ts` holds the domain rules and never imports Fastify. Only `apps/api/src/todos/repository.ts` and `apps/api/src/db/` touch Drizzle or SQL, through the query builder, never string-built SQL.
- **Web (AD-11, AD-13, AD-14):** components read and change todos only through the hooks in `apps/web/src/todos/`. Only those hooks call the one API client, `apps/web/src/api/client.ts`. Every write goes through the one optimistic-mutation helper (`apps/web/src/todos/mutations.ts`), which applies the change at once, reverts only that change on failure, and announces the outcome. All wording lives in `apps/web/src/todos/messages.ts`, and outcomes are spoken only through the one announcer. Components render no toasts of their own.

To add an endpoint, contract first:

1. Add or change the TypeBox schema in `packages/contract/src/` and export it from `index.ts`. Request, response and problem shapes live only there, and the web imports their types with `import type` (AD-5).
2. Add the repository method, then the service rule, then the route under `/api` with the schemas in its `schema`. Errors are RFC 9457 problems with one of the existing `/problems/*` types (AD-9).
3. Regenerate and commit the contract: `pnpm gen:openapi`. CI fails if `packages/contract/openapi.json` is stale.
4. To change the schema, edit `apps/api/src/db/schema.ts`, then run `pnpm --filter @todo/api db:generate` and commit the new file in `apps/api/drizzle/`. The API applies migrations at startup. Migrations only add things (new columns are nullable or defaulted), and a merged migration is never edited (AD-15).
5. Add the client function in `apps/web/src/api/client.ts`, a mutation spec through the helper, and its messages in `messages.ts`.
6. Write tests with their scenario ids: unit beside the code (`*.test.ts`), component tests (`*.component.test.tsx`, with MSW as the only HTTP stub), integration in `apps/api/test/integration/`, contract in `apps/api/test/contract/`, e2e in `e2e/` (with an axe scan at each key state, which `pnpm test:all` enforces). Then run `pnpm test:all`.

There are no test-only routes or flags in app code. E2e injects failures with Playwright's `page.route` (AD-20).

## Quality reports

[`docs/quality/`](docs/quality/) holds the dated coverage, performance, accessibility and security reports for each epic, named `<yyyy-mm-dd>-<epic>-<report>.md`. They are written from `pnpm test:all` and the measurement scripts above: `scripts/perf-api.mjs`, `e2e/perf/first-load.mjs` and `e2e/perf/lighthouse.mjs`.
