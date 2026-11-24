# Review: reconcile spine against ticket

- Spine: `architecture-todo-app.md` (draft, 2026-11-23)
- Ticket: `initiative-todo-app.md` (plus companion `test-strategy.md`, which the spine lists as a source)
- Context: `.memlog.md`
- Known, intentional departures, not flagged: C12 Cloudflare hosting replaced by the Hetzner host (`limber`) with the compose `prod` profile and Cloudflare Tunnel ingress; SQLite backups deferred by the user.

## Verdict

**Reconciles, with fixes.** No requirement is contradicted beyond the known departures, and the core loop (R1–R13), persistence, contract, error shape, layering and C1 seam are well covered. The gaps are quiet ones: whether the failure message is visible on screen (R7, R9), whether the deployed images are the tested images and whether only a green suite deploys (AD-1, R22), health checks for services that are not built from this repo (R15 and the Done-when line about healthy dev and test profiles), surviving a host reboot, and traceability for C3, C4, C5, C8, C10 and R19. Six findings below have concrete fixes. Section C lists ticket items the PO needs to update because of the spine.

## A. Findings (spine vs ticket)

### F1 — The failure message and the list error state may not be visible (R7, R9, R12) — High

AD-14 routes every save-failure and status message, and the list's error state, through one `aria-live` region, and says "No component renders a separate toast or alert for a mutation outcome." It does not say the region is visible. The usual pattern is a visually hidden live region. Then R7 ("a message says so") reaches screen-reader users only, and R9's distinct **error state** in the list could be implemented as an announcement only. That is the opposite of the ticket's intent, and a sighted user would see a change revert with no explanation (E6).

**Fix:** Amend AD-14. The announcer region is rendered **visibly** (a status area on screen, not `sr-only`), and the same element is the live region, so sighted and screen-reader users get the same text. The list's error state (R9) renders visibly in place of, or above, the list. It shows in place of the list only when there is no cached data, so the list is never lost (R12). It also publishes to the announcer.

### F2 — "Tested images run in production" and "a failing suite deploys nothing" are not enforced by the delivery shape (AD-1, AD-18, R22) — High

The source tree has `ci.yml` (every push) and a separate `deploy.yml` (green main). If `deploy.yml` triggers on push to `main` and builds its own images, it (a) deploys images that were not the ones the `test` profile ran, which breaks AD-1, and (b) can race or ignore the CI result, which breaks R22's "a failing suite deploys nothing". "Only a green `main` deploys" states the intent but not a mechanism.

**Fix:** Amend AD-18. Use one workflow. The `test` job builds `api` and `web` once and runs `pnpm test:all` against those images. A `deploy` job then runs with `needs: test` and `if: github.ref == 'refs/heads/main'`, and pushes those exact images (same digest) to GHCR as `:<sha>`. Add a `concurrency` group for deploys so that two quick pushes to `main` can't deploy out of order. If the post-deploy `/api/health` check fails, the job fails, so the commit shows red.

### F3 — Not every container in every profile has a health check (R15, C6, Done-when "dev and test profiles start healthy") — Medium

AD-17 says, "Every image declares a `HEALTHCHECK` that uses only tools already in that image". That covers `api` and `web`. It leaves out two services:
- `cloudflared` in `prod` is a third-party image with no `HEALTHCHECK`, and it is distroless (no `wget` or shell). R15 says *each container* reports healthy or unhealthy, and `up -d --wait` treats a service with no health check as merely running.
- `web-dev` in `dev` is the Vite dev server, not the nginx image, so the image-level `HEALTHCHECK` doesn't apply. The Done-when line requires the **dev** profile to start healthy.

**Fix:** Amend AD-17. **Every compose service in every profile** has a health check, from the image or declared in `compose.yml` where the image has none. For `web-dev`, use a `node -e "fetch(...)"` probe of the Vite port. For `cloudflared`, enable its metrics server and probe its readiness endpoint with something the image can run, or with a sidecar-free approach confirmed during the tracer. The tracer must verify that `docker compose ps` shows `healthy` for all services in `dev`, `test` and `prod`.

### F4 — Prod has no restart policy, so a host reboot leaves the app down (R11, Done-when "deployed app reports healthy") — Medium

R11 and the restart scenario (I6) are about data surviving a restart, and the volume handles that. But no AD sets `restart:` for `prod` services. After a reboot of `limber`, or a crash of `api`, the stack stays down until the next deploy. The deployed app would then not report healthy, even though no code changed.

**Fix:** In AD-16 (or AD-1), give `prod` services `restart: unless-stopped`. Add a line to the README on what happens after a host reboot.

### F5 — Traceability holes: C3, C4, C5, C8 and C10 have no AD or map row, R19 is mapped as "Deferred", and the C9 and C10 tools are not named — Medium

The frontmatter `binds` claims all of C1–C12, but no AD lists C4, C5, C8 or C10 in its **Binds**, and the Capability map has no rows for C3–C8, C10 or C11. Specifically:
- **R19** is mapped "C4 targets; Deferred", but R19 is in scope for v1. "Deferred" invites an epic to skip it.
- **C4 (100 ms UI, 300 ms p95 API)** is met structurally by AD-13 (the cache updates at once), but no AD cites it, and the spine doesn't say which environment (`test` profile or prod) is measured.
- **C9** says "Postman MCP or equivalent". The memlog chose a Vitest and Ajv suite against the **running** API in the `test` profile, but the spine only says "contract tests in `apps/api/test/contract/`". An epic could write them with `fastify.inject`, which does not exercise the running API, and so would not meet C9.
- **C10**: Lighthouse and Chrome DevTools MCP appear nowhere in the spine (not in Stack, Conventions or the map). axe-core is present, but no tag set is pinned. By default axe does not limit itself to WCAG 2.2 AA, so "no AA violations" has no fixed meaning.
- **C3** ("easy for a new developer to understand, run, deploy and extend") rests on AD-10 and the README line. **C8** (the tracer sets up every layer first) rests on the Tests convention. Neither is mapped.

**Fix:** Add map rows: C4 → AD-13, measured per `test-strategy.md` Reports (Chrome DevTools MCP against the `test` profile built images). Change R19 to "`docs/quality` performance report, method in test-strategy; tuning deferred until a measurement calls for it". C8 → Conventions (Tests, One command), with the tracer owning the setup. C3 → AD-10, AD-16 and the README. In AD-5 or Conventions, state "the contract suite (Vitest + Ajv) runs against the running `api` in the `test` profile and validates every response, errors included, against `openapi.json`; this is C9's equivalent to Postman MCP." Add Lighthouse (CLI, pinned version) to Stack, run against the `test` profile at each epic's close. Pin the axe tags to `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.

### F6 — E6 (error handling e2e) has no sanctioned failure mechanism, which tempts a test-only branch in `api` (R17, AD-16) — Medium

E6 requires the e2e suite to run "with the API failing or unreachable" against the **built images** in the `test` profile. AD-16 forbids code branching on anything but validated config. Without a stated mechanism, the story that writes E6 is likely to add a fault-injection flag or route to `api`. That widens the prod attack surface (R20) and contradicts the intent of AD-16.

**Fix:** Add a Tests convention: e2e tests make the API fail with Playwright `page.route('/api/**', …)`, fulfilling with an RFC 9457 `5xx` body or aborting the request. "Unreachable" may also be shown by stopping the `api` service. `api` contains no test-only fault switches.

### Lower-priority observations

- **Mobile width (R8, Done-when "on a phone", E7):** the spine leaves R8 to UX, which is fine, but it doesn't name the Playwright projects. State in Tests that Playwright runs its default desktop browsers plus one phone-width project, so E7 has a home and the ticket's "browsers Playwright runs by default" boundary is explicit.
- **Character counting (AD-8 vs the ticket's 1–200 assumption):** JSON Schema `maxLength` counts code points, but JS `.length` counts UTF-16 units. Also, the TypeBox schema validates the *untrimmed* body before the service trims, so a 200-character description padded with spaces fails at the schema. State that 1–200 means code points after trimming, and that the schema's `maxLength` is applied the same way, or kept looser with the service as the authority.
- **Delete immediate, with no confirmation and no undo (Notes):** not recorded in the spine. That is acceptable, since it is a UX and story concern and not contradicted. AD-13's rollback on a failed delete re-inserts the todo, which matches R7. A `404` on `DELETE` (already gone) should not re-insert it. Say in AD-13 that a `404` on delete counts as success.
- **One shared list per deployment (Decision):** consistent, since there is no owner and `GET /api/todos` returns all todos. But with AD-3 the list is now **publicly writable on the internet** with no auth and no rate limiting (both Deferred). The ticket accepted one shared list, not explicitly one that the public can write to. Raise this with the PO (see C), and note it in the R20 security review.
- **C7 network:** the prod diagram says "own network", but AD-16 doesn't say so. Add "each profile runs on the project's own compose network; no `external` networks are shared with `limber`". This also supports AD-3's no-coupling aim.
- **README (Done-when):** present in the source tree ("run, test, deploy, extend"). Fine. Also state that it covers reading logs (`docker compose logs`, locally and over SSH on limber), because the Done-when line asks for "logs readable … from the README".
- **"Within 100 ms" (R7, C4):** satisfied by design through AD-13. Only the measurement location is missing (F5).
- **"Newest first":** AD-6 orders by `createdAt` desc then `id`. The optimistic helper should insert the new todo at the top with a provisional `createdAt`, so the list doesn't reorder when the server responds. A one-line addition to AD-13.

### Checked and landed (no action)

R1–R5, R10–R13 (AD-6/7/8/9/10/15); R2 field set; R3 list on open (AD-6/11); R4 reactivation (`PATCH completed`); R5 delete persists (AD-6, AD-15); R6 deferred to UX; R16 (AD-16); R17 and R18 (One command, coverage written, no threshold, consistent with the coverage assumption); R20 (AD-19); R21 (AD-18); C1 (AD-12); C2 (AD-2); C6 (Dockerfiles multi-stage and non-root, AD-17, AD-19); C11 (AD-18, GHCR path matches the repo); the out-of-v1 boundaries (no auth, sharing, priority, due dates, notifications, filtering, undo, load testing or pen testing were added); tracer path (all of it runs in compose and the test profile is provable); the optimistic add pattern reused by epic 2 (AD-13); quality reports per epic (`docs/quality/<date>-<epic>-…`).

## B. Spine contradicts ticket beyond known departures

None of substance. Minor naming: C7 names `docker-compose.yml`, and the spine uses `compose.yml` (the current canonical name). C7 lists dev and test profiles, and the spine adds `prod`, as R16 requires. Both are PO wording updates (C), not spine errors.

## C. Ticket items the PO needs to update because of the spine

1. **Description:** "deploys itself to production, tentatively on Cloudflare" → deploys to the existing Hetzner host through the compose `prod` profile, with public ingress through a Cloudflare Tunnel.
2. **C12:** rewrite. Production runs the same Docker images on the existing Hetzner host (`limber`) under compose project `todo` with the `prod` profile. Cloudflare provides ingress (Tunnel) and TLS only. Cite the architecture (AD-1, AD-3).
3. **Decision (2026-11-23) "Cloudflare is the tentative production host":** add a new dated decision that supersedes it. Cloudflare hosting was ruled out because Containers have ephemeral disk, which fails R11, and Workers + D1 would mean the tested images never ship (C6, C7).
4. **Open question "Does Cloudflare keep C2, C6, C7 and R11 intact?":** answered (no, for hosting). Close it with a reference to the spine.
5. **Open question "The stack beyond Docker…":** answered by the spine's Stack, AD-5 (OpenAPI 3.1 contract) and the test tooling. Close it.
6. **Assumption "CI and deployment run on GitHub Actions":** confirmed by AD-18. Promote it to a decision or reference.
7. **C7:** rename the file to `compose.yml` and add the `prod` profile (dev, test, prod).
8. **Boundaries, Cloudflare touch point:** change "the tentative production host, needing an account and an API token" to "public ingress via Cloudflare Tunnel and DNS for the public hostname, needing an account, a tunnel and its token".
9. **Boundaries, new touch points (owner epic-todo-foundation):**
   - Hetzner host `limber`: SSH deploy access (key and user), a directory for compose project `todo`, a host-side `.env`. It must not alter the existing limber stack or bind 80/443.
   - GitHub Container Registry: image packages `bmad-todo-{api,web}`, plus pull credentials on limber unless the packages are public.
   - GitHub touch point: list the secrets now known (SSH key and host, tunnel token, GHCR auth).
10. **Boundaries, Out in v1 (new dated decisions needed under C5):** backups of the SQLite volume (user decision); monitoring, alerting, log retention and uptime checks beyond `docker compose logs` and the post-deploy health check; rate limiting and abuse protection.
11. **Decision needed (risk):** the one shared list is now publicly writable on the internet with no auth or rate limiting. Confirm that this is acceptable for v1, or choose a mitigation (for example, Cloudflare Access in front of the hostname, at the cost of R3's "no onboarding" for the public).
12. **R6, R8 ownership:** the spine defers visual design, completion styling and breakpoints to `bmad-ux` and the stories. The ticket doesn't plan a UX run. Decide whether `bmad-ux` runs before epic-todo-foundation's first UI story, and note it.
13. **Frontmatter `risk: high`:** it may be worth revisiting now that the main hosting unknown (the Cloudflare fit) is resolved. Optional.
