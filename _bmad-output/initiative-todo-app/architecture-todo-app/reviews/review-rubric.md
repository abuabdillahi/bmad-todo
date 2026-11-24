---
type: architecture-review
target: _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md
against: good-spine checklist (7 items)
inputs: [initiative-todo-app.md, tickets/tickets.toml, tickets/*/epic-*.md, test-strategy.md, notes-quality-infra.md]
reviewed: '2026-11-23'
verdict: revise
---

# Rubric review: Architecture Spine, Todo App v1

## Verdict

**Revise before epic 1 is refined.** The spine is strong on the application seam: the API surface, Todo shape, error format, layering, the single optimistic-mutation helper, and the announcer are all clear, enforceable invariants that both epics can rely on. The problems are in the compose and delivery topology and in the test harness. Taken together, the profile, service and port rules cannot be implemented as one `compose.yml`. The "tested image = prod image" invariant is stated but nothing enforces it. The test-harness decisions that epic 1's tracer story sets and epic 2 inherits are left undecided. Several operational-envelope items needed on a shared host are missing, and the spine has no Open Questions section to hold them.

## Scorecard

| # | Checklist item | Result | Main findings |
| --- | --- | --- | --- |
| 1 | Fixes the real divergence points; misses none | Partial | F3, F6, F7, F8, L5 |
| 2 | Every AD's Rule is enforceable and prevents its stated divergence | Partial | F2 (AD-1), F6 (AD-13), L1 (AD-12) |
| 3 | Nothing Deferred could let two units diverge | Partial | F7 (UI deferred to an unscheduled UX step) |
| 4 | Covers every ticket requirement | Mostly | F8 (C12 override not reconciled), L10 (R18), L11 (R19), L9 (C10) |
| 5 | Every owned dimension is decided, deferred or open, especially ops | Partial | F4, F2 (rollback and delivery), no Open Questions section |
| 6 | Only invariants in ADs; minimal seed; valid mermaid | Mostly | L2, L3, L13. The mermaid is valid. |
| 7 | Internal consistency | Fails | F1 (critical), F5 |

---

## Findings, ranked

### F1 (CRITICAL): One `compose.yml` cannot satisfy the profile, service and port rules as written (items 7 and 5)

- The profile table puts `web` in both `test` (with a "localhost port, for Playwright") and `prod` ("Host ports: none"). AD-3 says no `prod` service publishes a host port. Compose profiles only select services. They cannot add or remove `ports:` on a shared service definition, and AD-16 forbids forked or override compose files. So either `prod` publishes the port, which breaks AD-3, or Playwright has nothing to reach, which breaks `test`.
- The table also names `api` in `dev` (watch mode, source mounted) and in `test` and `prod` (built or GHCR image). A single service definition cannot be both a source-mounted watcher and an immutable image. So `dev` needs its own service (for example `api-dev`). That breaks the Vite proxy target unless the spine fixes a network alias.
- AD-4 says "`web` proxies `/api/*` … the Vite dev server in `dev`", but the `dev` service is called `web-dev`.
- AD-16 gives each profile its own named volume (`todo-dev-data`, `todo-test-data`, `todo-data`). If `test` and `prod` share the `api` definition, the volume source has to be interpolated, and the spine doesn't say how. The project name is fixed only for prod (`todo`). Locally, all three profiles default to the directory's project name, so `down -v` to "reset each run" may also remove the dev volume. Compose's `-v` removes the project's declared named volumes.

**Fix:** Make the topology explicit in AD-16 and the profile table:
(a) Use distinct services per runtime shape: `web-dev` and `api-dev` in `dev`, with `api-dev` carrying network alias `api`, so the Vite proxy and nginx both target `http://api:<port>`. Use `web` and `api` for `test` and `prod`.
(b) Pick one way to reach the test stack. Either run Playwright and the HTTP test runners as a `test-runner` service on the compose network that targets `http://web:8080`, so no profile except `dev` publishes a port. Or add a test-only `web-test` service that `extends: web` within the same file and adds `127.0.0.1:<port>:8080`.
(c) Fix the project names per environment (`todo-dev`, `todo-test`, `todo`), or give the volumes explicit `name:`s, so a test reset can never touch dev or prod data.
(d) Rename `web` to `web-dev` in AD-4's dev clause.

### F2 (HIGH): AD-1's Rule doesn't enforce its own invariant, and delivery mechanics are open (items 2 and 5)

AD-1 *Prevents* "dev, test and prod running different … artifacts", but its Rule only says prod runs images "built from this repo's Dockerfiles". AD-18 says CI runs `pnpm test:all` (which builds images in the test profile), and then "that deploy pushes `ghcr…:<git-sha>`". Nothing stops `deploy.yml` from rebuilding, and a rebuild is not the tested artifact. The spine also doesn't decide:

- how prod compose learns the SHA (no `IMAGE_TAG` variable)
- how `compose.yml` at that SHA reaches limber (a repo checkout on the host? `scp`?)
- what "deploying an earlier SHA" means in practice (a `workflow_dispatch` input?)
- what happens when the post-deploy health check fails
- whether concurrent pushes to `main` can deploy out of order

**Fix:** Rewrite the AD-1 and AD-18 Rules:
- CI builds each image once, tagged `:<sha>`, and runs the `test` profile against exactly those tags.
- Only on a green `main` does CI push those same tags to GHCR. `deploy.yml` never builds.
- The compose `image:` is `ghcr.io/abuabdillahi/bmad-todo-{api,web}:${IMAGE_TAG}`.
- The deploy copies `compose.yml` at `<sha>` to the host and writes `IMAGE_TAG=<sha>` into the host `.env`.
- Rollback is `deploy.yml` via `workflow_dispatch(sha)`.
- A failed post-deploy health check fails the workflow. Decide whether it then redeploys the previous SHA automatically or leaves it to a person.
- Deploys run in a single `concurrency` group.

### F3 (HIGH): The test-harness topology, isolation and fault injection are undecided, and epic 2 inherits whatever epic 1 improvises (item 1)

Several scenarios split across the epics depend on decisions the spine doesn't make:

- **Where integration tests run.** The test strategy says "API and storage in the test profile", and the spine sets `apps/api/test/integration/`. In-process `inject` against a temp DB and HTTP against the container are both possible, and they lead to different fixtures. I6 (restart the API container) needs the container. AD-2 forbids tests opening the DB file while `api` runs, so I2's "stores nothing" must be checked through the API.
- **e2e data isolation.** There is one shared SQLite list in `test`, AD-6 forbids a bulk endpoint, and Playwright runs parallel workers by default. E5 (empty state, epic 2) and E1 (epic 1) will interfere with each other unless isolation is fixed.
- **Fault injection.** Epic 1's "failed add reverts", epic 2's E6 ("API failing or unreachable") and "API slow" (loading state), and I7 (storage unreachable gives 503) all need a failure mechanism. AD-16 ("code never branches on anything except validated config") leaves open whether a test-only fault flag is allowed.
- **Component-test stubbing.** MSW is in Stack, but no rule says component tests stub HTTP rather than mocking hooks or the client. K1 is in epic 1 and K2–K5 are in epic 2.
- **Contract tests (C9).** Ajv is listed, but no rule says what is validated against what.

**Fix:** Add a "Test harness" AD (or Conventions rows):
- Integration tests build the Fastify app in-process on a fresh temp SQLite file per file. I6 alone runs against the `test` container.
- I7's 503 path is tested in-process with a broken DB handle.
- Contract tests send real HTTP to the `test` stack and validate every response, errors included, with Ajv against `packages/contract/openapi.json`.
- e2e uses `workers: 1`, and a `beforeEach` empties the list via `GET` plus `DELETE` for each todo.
- Failing, slow and unreachable API behaviour is injected only with Playwright `page.route`. The app has no test-only endpoints or fault flags.
- Component tests stub HTTP only with MSW handlers typed from the contract. They never mock hooks or the client module.

### F4 (MEDIUM): Operational-envelope gaps on a shared host, and no Open Questions section (item 5)

On the shared host, the spine leaves these undecided:
- **Restart policy.** Without `restart: unless-stopped`, a host reboot leaves the app down. The data survives, but the app doesn't come back, which undercuts R11 "survives a server restart" in prod.
- **Log rotation.** Docker's default `json-file` driver is unbounded. Deferring log *retention* doesn't cover disk exhaustion on limber, which would also hurt the limber project that AD-3 tries to isolate.
- **GHCR package visibility.** If the packages are private, limber needs a pull credential, and it isn't listed among the secrets.
- **Protecting the prod volume.** Nothing guards it against `down -v`.
- **DB file path and env var.** The path inside the container and the variable that sets it are not fixed.
- **Migrations and rollback.** AD-15 says migrations are "additive", but rollback to an older SHA is only safe if new columns are nullable or defaulted.

The spine has no Open Questions section, so none of these is visibly "open".

**Fix:**
- Add `restart: unless-stopped` and `logging: { driver: json-file, options: { max-size: 10m, max-file: "3" } }` to every prod service (AD-16 or AD-17).
- State GHCR visibility and the pull credential.
- Give the prod volume an explicit `name: todo-data` and forbid `down -v` in prod. Alternatively, mark it `external`.
- Fix `DATABASE_PATH=/data/todo.db`.
- Extend AD-15: new columns are nullable or defaulted.
- Add an Open Questions section for anything left undecided.

### F5 (MEDIUM): Three internal contradictions between ADs (item 7)

1. **AD-9 vs AD-6 and AD-17.** AD-9 says "every non-2xx response from `api` is `application/problem+json`", but `GET /api/health` returns `503 {status:"unavailable"}`. **Fix:** exempt `/api/health` explicitly in AD-9, or make the 503 a problem document.
2. **AD-10 vs the source tree and AD-17.** AD-10 says "the repository is the only module that touches Drizzle or SQL". But `src/db/` exists (connection, schema, migrator), and AD-17's health route runs `select 1`. **Fix:** "only `src/db/` (connection, schema, migrator, `ping()`) and `src/todos/repository.ts` import Drizzle or better-sqlite3. Health calls `db.ping()`."
3. **AD-8 internal.** The service trims and then requires 1–200 characters, but "`maxLength` comes from the contract", and route schemas validate the raw value *before* the service trims it. A padded description whose trimmed length is 200 or less gets a schema 400. "Characters" is also undefined: Ajv counts code points, while a client pre-check with `.length` counts UTF-16 units, so emoji input disagrees. **Fix:** "the client sends trimmed text; schema `maxLength: 200` applies to the raw value; length is counted in Unicode code points on both sides", or keep `maxLength` out of the request schema and enforce it only in the service.

### F6 (MEDIUM): AD-13 doesn't fully prevent mutations from overwriting each other (item 2)

`scope` serializes mutations per id only, so mutations on different todos run in parallel. Invalidating `['todos']` "when the mutation settles" refetches server state while another todo's optimistic change is still pending, so that change visibly disappears and comes back. An in-flight list `GET` can also land after the optimistic write. Separately, R12 says failures happen "without losing the list", but nothing says the list's error state must not replace cached data when a background refetch fails.

**Fix:** Add to AD-13:
- "Before applying, `cancelQueries(['todos'])`."
- "Invalidate only when no other todo mutation is pending (`isMutating({ mutationKey: ['todos'] }) === 1`)."
- "The list renders its error state only when there is no cached data. A failed refetch with data present goes to the announcer only."

---

## Lower-ranked findings

### Medium

- **F7 (items 3 and 1): Deferred UI has no scheduled owner.** Deferred hands visual design, component breakdown, completion styling and breakpoints to `bmad-ux`, but neither the initiative nor the epics schedule a UX step. Epic 1 builds the list UI and epic 2 adds item controls and completion styling to it, while epic 2 "must not change … list behaviour". Two architecture-level choices are also missing: the **styling technology** (none in Stack) and **focus management** after delete, after an edit is saved or cancelled, and after an optimistic rollback (WCAG 2.4.3, part of R14). **Fix:** pick the styling approach in Stack. Add a focus rule to AD-14, or record an Open Question gating epic 1 refinement on `bmad-ux`.
- **F8 (item 4): The C12 override isn't reconciled with the ticket.** C12 allows replacing Cloudflare only "if the architecture finds that this rules out a requirement or constraint". AD-1 replaces it without naming which R or C is ruled out. That is one line, and it can live outside the AD. The initiative's open question and epic 1's open question about Cloudflare are left dangling. The ticket and epic touch points still say "Cloudflare … account and API token", while the spine needs a Hetzner host (`limber`, SSH), GHCR and a tunnel token. **Fix:** add a "Ticket impacts" or Open Questions entry: close the Cloudflare question (C2 and R11 break on ephemeral disk), and update the touch points for both epics.

### Low

- **L1 (item 2):** AD-12's Rule is mostly a forecast ("adding owners later means … No route, service signature … changes"), which can't be enforced. Keep only the enforceable part: no `owner_id` and no auth in v1, and only the repository imports the `todos` table schema.
- **L2 (item 6):** There is rationale and duplication inside Rules. AD-1 tells the C12 history ("replaced by this rule… only role is the ingress"). AD-4's last sentence repeats AD-3. AD-6's "a prefix is introduced only for a breaking change" repeats Deferred.
- **L3 (items 6 and 7):** `[ADOPTED]` appears on AD-1, 2, 3, 6, 7 and 9 only. Say whether the unmarked ADs are binding or proposals.
- **L4 (item 7):** Paths don't line up. The layer table has `apps/web/src/**/components`, but the source tree has `src/components/`. The announcer is a layer with no path. `src/db/` is in the tree but not in the layer table.
- **L5 (item 1):** Small API divergence points between epic 1 (`POST`) and epic 2 (`PATCH`/`DELETE`). A malformed (non-UUID) path id could get `400` or `404`. Unknown body properties could be rejected or silently stripped, and Fastify's Ajv defaults to `removeAdditional`. **Fix:** "a non-UUID path id gives `404`" (or `400`); "request schemas set `additionalProperties: false` and unknown properties are rejected with `400`".
- **L6 (item 7):** "ordered `createdAt` desc, then `id`" doesn't give the tie-break direction. AD-10 puts ordering in the service, but the repository will naturally `ORDER BY`. Say which.
- **L7 (items 5 and 7):** R15 says *each container* reports health. `cloudflared` is a container, and its image is distroless (no `wget` or shell), so AD-17's "every image declares a HEALTHCHECK … `node` or `wget`" doesn't cover it. `up -d --wait` treats it as healthy once running. Decide on a `cloudflared` health check (its metrics `/ready` endpoint) or exempt it explicitly.
- **L8 (item 7):** The Logging convention says "nothing logs todo text at `info` or below". That still allows todo text at `warn` and `error`, which is probably the reverse of what is meant.
- **L9 (items 4 and 6):** Stack gaps. Lighthouse (C10, used at every epic close) is not listed. The Node base image and its variant are not listed, which matters for the `better-sqlite3` native build. ESLint and typescript-eslint are referenced in Deferred but not listed. C10's Playwright MCP and Chrome DevTools MCP are never reconciled with `@playwright/test`.
- **L10 (item 4, R18):** "per layer" coverage. v8 coverage can't be collected from containerized e2e or contract runs. Say which layers produce coverage and how the reports are merged.
- **L11 (item 4, R19):** The performance measurement environment is not fixed: the local `test` profile, or prod through Cloudflare. Epic 1's API timings and epic 2's profiles won't be comparable.
- **L12 (item 5):** Contract generation. Say whether the generated TS types are committed and covered by the CI diff check, and that generating `openapi.json` boots the app without a DB or listener.
- **L13 (item 6):** The deploy diagram draws the SSH edge from `ghcr` to `todo`. Actions performs the SSH and the host pulls from GHCR. The shape is slightly misleading.
- **L14 (item 1):** With a client-minted id, a `POST` retried after a lost response returns `409` even though the todo is stored. AD-13 will roll it back, and then the refetch brings it back. Decide whether a `409` with an identical body counts as success, or rule out retries.
- **L15 (item 6):** Deferred says backups are "out of v1 by decision", but the ticket records no such decision. Cite it or reword.
- **L16 (item 5):** The `dev` profile mounts source into a container with a native module (`better-sqlite3`). Say that `node_modules` comes from the container, not the macOS host mount. A one-line convention is enough.

## What is good (keep)

- AD-6, AD-7 and AD-9 together fix the whole wire contract, including client-minted UUIDs. That removes temp-id handling from both epics.
- AD-5's "generated, committed, CI diff" contract is an enforceable single source of truth.
- AD-11, AD-13 and AD-14 correctly make epic 1's optimistic add the pattern epic 2 must reuse, which matches the initiative's decision.
- AD-3's tunnel ingress cleanly avoids port conflicts with limber's nginx.
- The Capability map covers every R. The three mermaid diagrams are syntactically valid and show the right shape.
