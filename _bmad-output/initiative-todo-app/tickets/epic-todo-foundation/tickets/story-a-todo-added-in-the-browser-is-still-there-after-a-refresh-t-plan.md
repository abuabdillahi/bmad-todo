---
title: 'Tracer: a todo added in the browser survives a refresh, with every test layer behind pnpm test:all'
type: feature
ticket: '1'
created: '2026-11-24'
status: ready-for-dev
baseline_revision: ''
route: full
route_source: auto
risk: medium
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md'
  - '{project-root}/_bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repo has planning only and no code. Nothing proves the stack end to end: browser, nginx, Fastify, SQLite and Docker, and the test layers that every later story extends.

**Approach:** Build the thinnest vertical slice from the spine's Structural Seed. It is a pnpm monorepo (`packages/contract`, `apps/api`, `apps/web`, `e2e`) with GET and POST `/api/todos` and GET `/api/health` on SQLite, and a React page with the heading, add form and list in light and dark. It includes both Dockerfiles and the compose `test` profile, and the AD-20 harness: Vitest `unit`/`component`/`integration`/`contract` projects plus Playwright, behind `pnpm test:all` with coverage.

## Boundaries & Constraints

**Always:** Follow the spine exactly: Stack versions, Conventions (naming, ports, env names, test file locations, scenario-id test titles, toolchain), AD-2, AD-4 (path unchanged, re-resolving upstream), AD-5 (TypeBox in `packages/contract`, generated and committed `openapi.json`, web `import type` only), AD-6 and AD-7 for the three endpoints, AD-10 layering and `buildApp({ config, db })`, AD-11's single `['todos']` query in server order, AD-12, AD-15 (migrations committed, applied before listen), AD-16 test profile and `.env.example`, AD-17 health checks and `restart: unless-stopped` for `api` and `web-test`, AD-19, AD-20. UI strings, tokens and markup come from DESIGN.md and EXPERIENCE.md. The add waits for the server. On success the field clears and focus stays in it. On failure the text stays, nothing is added, and no message shows (epic Decision 2026-11-24).

**Never:** Optimistic add, mutation helper, announcer, todos store, `messages.ts` failure wording (stories 5–6). Problem schema, error handler, nginx 503 fallback, AD-8 trim/control-character rules, Ajv overrides, 409 replay (story 3). Client validation messages and paste cleaning (story 4). Dev profile, log rotation, pino request ids, I6 (story 7). CI and prod deploy, `cloudflared` (story 2). Empty, loading and error list states (epic 2). No `disabled`/`aria-disabled`, no placeholder, no `dangerouslySetInnerHTML`, no test-only code paths in app code, no CSS framework.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Create | `POST /api/todos {id: uuid, description}` | `201` Todo with `completed:false`, server `createdAt` ISO ms UTC; row stored | — |
| List | `GET /api/todos` | `200` all todos, `createdAt` desc then `id` desc; `[]` when none | — |
| Health | `GET /api/health`, db reachable | `200 {"status":"ok"}` via `repository.ping()` | 503 half is story 3 |
| Add in UI | valid text, Add or Enter | card on top after the server answers; field clears to "0/200"; focus stays in field | failed POST: text kept, list unchanged, no message |
| Reload / new session | todo added, page reloaded or new context | todo still listed | — |

## Decisions

- 2026-11-24, user: Keep the full plan despite its size (tracer story, epic decision).
- 2026-11-24, user: The agent installs pnpm 12.23.0 with nvm's Node 26.13.1 (`npm i -g pnpm@12.23.0`) and prefixes its commands with `~/.nvm/versions/node/v26.13.1/bin`; the user's shell profile is not changed. The person still runs the story's Verify.
- 2026-11-24, user: The add form shows the "n/200" counter now, counting the raw text's Unicode code points (`[...value].length`); story 4 makes it count the cleaned text.
- 2026-11-24, user: A submit whose text is empty after `trim()` sends nothing and shows no message; a non-empty submit sends the trimmed text. Story 4 replaces this with the AD-8 client check.
- 2026-11-24, user: E2e list reset: each test adds a todo with a unique description and asserts only on its own todo; `test:all` starts `todo-test` on a fresh volume and removes it on teardown. Epic 2 adds the AD-20 reset through DELETE.
- 2026-11-24, user: Build on a new branch `story-1-1-tracer`, not `main`.

</frozen-after-approval>

## Code Map

The project is greenfield: no app code exists. Facts that bind the build:

- Node 26.13.1 is under `~/.nvm/versions/node/v26.13.1/bin`, which is not on the shell PATH. Prefix commands with that bin. Its pnpm is 12.21.0; the spine pins 12.23.0 (hitl setup).
- Docker 29.9.3, Compose v5.7.1. Ports 8081 and 5173 are free. `origin` is `git@github.com:abuabdillahi/bmad-todo.git`.
- Every Stack version exists on npm. Base images exist: `node:26.13.1-bookworm-slim` (api; glibc for the better-sqlite3 prebuild) and `nginx/nginx-unprivileged:1.30-alpine`.
- pnpm blocks install scripts. `allowBuilds` must list `better-sqlite3` beside `esbuild`, or the native binding is missing.
- typebox is the `typebox` 1.x package (not `@sinclair/typebox`), used with `@fastify/type-provider-typebox` 6.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc` -- workspace with `packageManager: pnpm@12.23.0`, `allowBuilds`, scripts `test:all`, `typecheck`, `gen:openapi` -- C3 one command
- [ ] `packages/contract/src/{todo,health,index}.ts` -- TypeBox `Todo`, `CreateTodoBody` (`id` uuid, `description` string 1–200, `additionalProperties:false`), `TodoList`, `Health`; `openapi.json` generated and committed -- AD-5/6/7
- [ ] `apps/api/src/{config,app,server}.ts`, `src/db/{client,schema,migrate}.ts`, `drizzle/`, `src/todos/{repository,service}.ts`, `src/routes/{todos,health}.ts`, `scripts/gen-openapi.ts` -- env validated at startup, migrations before listen, swagger 3.1.0, routes under `/api`; service sorts newest first -- AD-2/10/12/15/16
- [ ] `apps/api/Dockerfile` -- multi-stage, non-root, Node-fetch health check -- C6, AD-17/19
- [ ] `apps/web/src/api/client.ts`, `src/todos/hooks.ts`, `src/components/{App,AddForm,TodoList,TodoCard}.tsx` + `.module.css`, `src/styles/tokens.css`, `index.html` -- `useTodos` (one `['todos']` query), `useAddTodo` (mints UUID, waits for 201, then invalidates); markup, strings and tokens per DESIGN/EXPERIENCE; textarea with Enter submit (not while composing), "n/200" counter, hidden "Press Enter to add" hint -- AD-11, R14
- [ ] `apps/web/nginx.conf`, `apps/web/Dockerfile` -- SPA, `/healthz`, `/api/*` proxied unchanged via `resolver 127.0.0.11 valid=5s ipv6=off`, CSP and security headers; build → nginx-unprivileged on 8080 -- AD-4/19
- [ ] `compose.yml`, `.env.example` -- services `api` and `web` (`prod` profile) and `web-test` (`extends: web`, `test` profile, `127.0.0.1:${TEST_WEB_PORT:-8081}`); `data` volume on api only; health checks; `depends_on: service_healthy` -- AD-16/17
- [ ] `vitest.config.ts` (projects `unit`, `component`, `integration`, `contract`), `apps/web/test/setup.ts` (MSW) -- AD-20
- [ ] Tests: `apps/api/src/todos/service.test.ts` (U2); `apps/api/test/integration/{todos,health,openapi}.test.ts` (I1, I3, I7 healthy, committed `openapi.json` equals generated); `apps/api/test/contract/todos.contract.test.ts` (I9 success responses, Ajv2020 + ajv-formats against `E2E_BASE_URL`); `apps/web/src/components/AddForm.component.test.tsx` (K1 submit-and-clear, failed add keeps text; K6 names and keyboard) -- C8
- [ ] `e2e/playwright.config.ts`, `e2e/todos.spec.ts` -- projects `desktop`, `phone`, `desktop-dark`, `reducedMotion:'reduce'`, `workers:1`, list reset per Decisions; E1 create-and-reload plus a new-context check, axe on every state -- E1, E7, E8
- [ ] `scripts/test-all.mjs`, `scripts/scenario-coverage.mjs` -- compose `-p todo-test --profile test up -d --build --wait`; run unit/component/integration with v8 coverage to `coverage/<project>`, then contract and e2e with JSON reports; write `coverage/scenarios.md` (id → pass/fail); always `down -v`; non-zero on any failure -- R17, R18

**Acceptance Criteria:**
- Given a clean clone with the toolchain, when `pnpm install && pnpm test:all` runs, then every layer passes and `todo-test` is torn down afterwards.
- Given `todo-test` up, when a user adds a todo at http://127.0.0.1:8081, reloads, then opens a private window, then the todo is listed each time.
- Given E1 runs in `desktop`, `phone` and `desktop-dark`, when axe scans each reached state, then it reports no WCAG 2.2 AA violations.
- Given `docker compose -p todo-test --profile test ps`, then `api` and `web-test` are healthy, both run as non-root, and the API publishes no host port.
- Given the suites ran, then `coverage/unit`, `coverage/component`, `coverage/integration` and `coverage/scenarios.md` exist.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- Vitest gets a fourth project, `contract`, with no coverage, run only by `test:all` against `E2E_BASE_URL`. AD-20 names three projects for the coverage split, and contract is a container-run layer that reports by scenario id.
- Coverage by scenario id: the script parses test titles' leading id (`/^([UIKE]\d+)/`) from the Vitest contract JSON report and the Playwright JSON report.
- Service ordering (U2): `sortNewestFirst(todos)` in `service.ts` compares `createdAt` desc then `id` desc. The repository also does `ORDER BY created_at DESC, id DESC`.

## Verification

**Commands:**
- `pnpm typecheck` -- expected: no errors
- `pnpm test:all` -- expected: exit 0; every Vitest project and every Playwright project passes
- `pnpm gen:openapi && git diff --exit-code packages/contract/openapi.json` -- expected: no diff

**Manual checks (hitl):**
- The person confirms the toolchain, then runs the story's Verify: add, refresh, private window at http://127.0.0.1:8081.
