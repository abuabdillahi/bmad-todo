---
title: 'A green push to main deploys the tested images behind the Cloudflare Tunnel'
type: feature
ticket: '2'
created: '2026-11-24'
status: built
baseline_revision: '1b26f5db43d0c9273f0d03b4ce6c625e62f497c4'
route: full
route_source: auto
risk: medium
review: quick
review_source: pinned
lenses_ran: [quick]
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1's app runs only in `todo-test` on a developer machine. Nothing tests pushes, and nothing puts the app in production.

**Approach:** Add one GitHub Actions workflow. Its `test` job builds both images at the git SHA and runs `pnpm test:all` on every push. Its `deploy` job, on a green `main` or a manual run with an earlier SHA, pushes those images to GHCR and deploys them over SSH to the Hetzner host as compose project `todo`, profile `prod`, with a new `cloudflared` service as the only ingress. It then checks the public `/api/health`.

## Boundaries & Constraints

**Always:** Follow AD-1, AD-2, AD-3, AD-5, AD-16–AD-19 and the Stack pin `cloudflare/cloudflared:2026.11.2`. The deploy pushes and runs the images the test job built (`docker save`/`load` between jobs). No step after `test` builds an image. Rollback reuses the GHCR images already pushed for that SHA. The host `.env` is rewritten whole on each deploy, mode 600, from secrets and variables plus `IMAGE_TAG`. The host is logged into GHCR only for the pull, using the job's `GITHUB_TOKEN`, then logged out. Secret values never appear in argv, logs or the repo. `cloudflared` has AD-17's health check, `restart: unless-stopped` and `depends_on: web: service_healthy`. No prod service publishes a port.

**Never:** `down -v` or any volume removal in prod. Long-lived registry tokens on the host. Hand-edited host files. Log rotation, pino request ids and dev services (story 7). README or docs (story 9). Changes to app code, tests or `scripts/test-all.mjs`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Push, any branch | commit pushed | `test` job runs typecheck, the openapi diff check and `test:all` with `IMAGE_TAG=<sha>`; result shows on the commit | red on any failure; deploy skipped |
| Green push to `main` | `test` passed | `deploy` pushes `:<sha>` images, deploys, public `/api/health` → `200 {"status":"ok"}` | any step fails → workflow red |
| Red push to `main` | `test` failed | `deploy` skipped; production unchanged | — |
| Rollback | `workflow_dispatch` on `main` with input `sha` | no test or build; deploys the GHCR images at `sha` with `compose.yml` from `sha` | images missing → pull fails, workflow red |
| Out-of-order | older green SHA reaches deploy after a newer one deployed | skipped with a notice; production keeps the newer SHA | — |

## Decisions

- 2026-11-24, user: Keep the full plan despite its size.
- 2026-11-24, user: The person sets the GitHub default branch to `main` as part of the hitl setup, so rollback by `workflow_dispatch` works.
- 2026-11-24, user: Build on the feature branch `story-1-2-deploy` and merge by PR. The rule "always use a feature branch, never `main`" goes in `AGENTS.md` (read through `CLAUDE.md`), so future agents don't ask.

</frozen-after-approval>

## Code Map

- `.github/` -- does not exist; the workflow is new.
- `compose.yml` -- `api` (`[test, prod]`) and `web` (`[prod]`) already use `ghcr.io/abuabdillahi/bmad-todo-{api,web}:${IMAGE_TAG:-local}` with `build:`, health checks and `restart`. `web-test` extends `web` with `profiles: !override [test]`. Add only `cloudflared`. Do not touch the others.
- `scripts/test-all.mjs` -- passes `process.env` through, so `IMAGE_TAG=<sha>` builds the SHA tags (`up --build`). `down -v` leaves the images in place. Its `playwright install chromium` has no `--with-deps`, so CI installs browsers with deps first.
- `apps/{api,web}/Dockerfile` -- add an `org.opencontainers.image.source` label, which links the GHCR packages to the repo so the job token can pull them.
- `.env.example` -- add `TUNNEL_TOKEN` (empty) and a comment naming the CI-only secrets and variable.
- Facts: `.nvmrc` is `26.13.1` and `packageManager` is `pnpm@12.23.0`. The cloudflared image runs as uid 65532 with entrypoint `cloudflared`, `tunnel run` reads `$TUNNEL_TOKEN`, and `tunnel --metrics 127.0.0.1:2000 ready` exists. `compose pull` exits 1 when a tag is missing. The repo is public and its GitHub default branch is `story-1-1-tracer`.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md`, `CLAUDE.md` -- already written: the feature-branch rule, with `CLAUDE.md` importing `AGENTS.md` -- Decisions
- [x] `compose.yml` -- add `cloudflared` (`profiles: [prod]`, the pinned image, `command: tunnel --no-autoupdate --metrics 127.0.0.1:2000 run`, `environment: TUNNEL_TOKEN: ${TUNNEL_TOKEN:-}`, AD-17 health check, `restart: unless-stopped`, `depends_on: web: service_healthy`) -- AD-3, AD-17
- [x] `apps/api/Dockerfile`, `apps/web/Dockerfile` -- `LABEL org.opencontainers.image.source=https://github.com/abuabdillahi/bmad-todo` on the runtime stage -- GHCR access for `GITHUB_TOKEN`
- [x] `.env.example` -- `TUNNEL_TOKEN=` with a comment. List the secret names `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `TUNNEL_TOKEN` and the variable `PUBLIC_HOSTNAME` -- AD-19, spine Deferred
- [x] `.github/workflows/ci.yml` -- triggers `push` (all branches) and `workflow_dispatch` (required input `sha`). Job `test` (push only, `contents: read`): checkout, `pnpm/action-setup`, `setup-node` from `.nvmrc` with the pnpm cache, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm gen:openapi && git diff --exit-code packages/contract/openapi.json`, `playwright install --with-deps chromium`, `IMAGE_TAG=${{ github.sha }} pnpm test:all`, upload `coverage/` always. On `main` it also uploads the `docker save` of both `:<sha>` images (retention 1 day). Job `deploy` (`needs: test`; runs when `!cancelled()` and the ref is `main` and either the event is a dispatch or `test` succeeded; `concurrency: {group: deploy-prod, cancel-in-progress: false}`; `contents: read`, `packages: write`): resolve SHA (input or `github.sha`, then `git rev-parse --verify` to the full SHA). Check out that SHA with full history. Set up SSH from secrets with strict host-key checking. On push: read the host's current `IMAGE_TAG` and skip with a notice if this SHA is its strict ancestor. Then load and push the images (push only), `scp compose.yml` to `~/todo/` and write `~/todo/.env` over SSH stdin with `umask 077` (`APP_ENV=production`, `LOG_LEVEL=info`, `IMAGE_TAG`, `TUNNEL_TOKEN`). Log in to GHCR on the host with the token on stdin. Run `docker compose -p todo --profile prod pull`, always log out (trap), then `up -d --wait --no-build --remove-orphans` and print `ps` and `images`. Curl `https://$PUBLIC_HOSTNAME/api/health` with retries and require `"status":"ok"` -- AD-1, AD-18, AD-19

**Acceptance Criteria:**
- Given the workflow, when `actionlint` and `docker compose --profile prod config` run, then both succeed and the prod config has no `ports`.
- Given `IMAGE_TAG=<sha> pnpm test:all` locally, then it passes and both `ghcr.io/abuabdillahi/bmad-todo-{api,web}:<sha>` images remain afterwards.
- Given the hitl setup, when the person runs the story's Verify (green push, red push and revert, rollback by dispatch), then each outcome matches the I/O matrix.

## Implementation Notes

- Action majors were checked with `gh`: checkout@v7, setup-node@v7, pnpm/action-setup@v6 (pnpm 12 from v6.1.0), upload-artifact@v7, download-artifact@v8. The push trigger is `branches: ['**']`, so tag pushes don't run it.
- SSH goes through a `~/.ssh/config` host `prod-host` (key, user, `StrictHostKeyChecking yes`, `BatchMode yes`). It has the same options as the Design Notes' `ssh -i` call, and both `ssh` and `scp` use it. It assumes port 22.
- Secret values are written only with the shell's built-in `printf` and reach the host on stdin. The host's GHCR login and pull run in one SSH session, with logout in a `trap`.
- The implementer simulated these locally:
  - a host directory holding only `compose.yml` and a generated `.env`, which resolves the tags and runs `up --no-build` as a dry run
  - the guard skips an older SHA and deploys the same or a newer one
  - the remote login script works in sh, bash and dash, and the trap keeps the failing exit code
  - `docker save` of both images comes to about 120 MB
- Matrix audit: every row is CI or host behaviour that no repo test can run. They are covered by actionlint, the local simulations above and the hitl Verify (green push, red push and revert, rollback). The out-of-order row has no hitl check, only the simulation.
- Re-verified 2026-11-24: actionlint is clean, the prod config is valid with 0 `published:`, `pnpm typecheck` passes, and `IMAGE_TAG=<HEAD> pnpm test:all` exits 0 with both `:<sha>` images left in place and labelled.

## Plan Change Log

## Review Triage Log

Pass 1 (quick): high 0, medium 0, low 4, false 0, maybe-false 0.

| # | Lens | Location | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|---|
| 1 | quick | `.github/workflows/ci.yml` deploy `concurrency` | When test jobs finish out of order (M3 before M2), M2's queued deploy replaces M3's pending one. M3, the tip of `main`, never deploys and its run shows cancelled. | low | reject | GitHub keeps one pending job per group, so this is real. It needs three quick merges whose tests finish out of order on a one-person repo. Production then stays on an older green SHA until the next push, and the cancelled run is visible. The fix needs new queueing logic, not a direct correction. |
| 2 | quick | `.github/workflows/ci.yml` guard step | The guard reads `IMAGE_TAG` from the host `.env`, which is rewritten before the pull and `up` succeed. After a failed deploy, it can skip an older SHA that is still newer than the live one, with a false "stays live" notice. | low | patch | The `.env` write step comes before Pull and Start. Reading the running `api` container's image tag is a one-line source swap. |
| 3 | quick | `.github/workflows/ci.yml` deploy `permissions` | The host is logged in with a `packages: write` token, while AD-18 says `packages: read`. | low | reject | A job token has a single permission set, and the same job pushes. The plan's Design Notes accept the trade-off, and the user approved it at checkpoint after it was named. The token is short-lived, scoped to this repo, sent on stdin and logged out in a trap. Honouring AD-18 strictly would mean splitting out a `publish` job. That is surfaced to the user as follow-up. |
| 4 | quick | `.github/workflows/ci.yml` deploy `if` | A `workflow_dispatch` from a branch other than `main` skips every job, so the rollback silently does nothing. | low | reject | Real. Once the hitl setup makes `main` the default branch, the dropdown defaults to `main`. The fix adds a guard path, which is more than a direct correction. |

## Design Notes

- One `deploy` job pushes and deploys, as AD-18 lays out. Its token has `packages: write` because the job pushes. The host gets that token only for the pull, over stdin, and logs out in a trap. The token expires when the job ends.
- The out-of-order guard uses `git merge-base --is-ancestor "$SHA" "$DEPLOYED" && [ "$SHA" != "$DEPLOYED" ]`. A green commit that a red one supersedes still deploys.
- SSH helper: write the key to `~/.ssh/deploy` (600) and `DEPLOY_KNOWN_HOSTS` to `known_hosts`, then run `ssh -i ~/.ssh/deploy -o StrictHostKeyChecking=yes "$DEPLOY_USER@$DEPLOY_HOST"`.

## Verification

**Commands:**
- `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest` -- expected: no findings
- `TUNNEL_TOKEN=x docker compose -p todo --profile prod config --quiet && docker compose -p todo --profile prod config | grep -c 'published:'` -- expected: config valid, count 0
- `IMAGE_TAG=$(git rev-parse HEAD) pnpm test:all && docker image inspect ghcr.io/abuabdillahi/bmad-todo-api:$(git rev-parse HEAD)` -- expected: exit 0
- `pnpm typecheck` -- expected: no errors

**Manual checks (hitl):**
- The person completes the epic's story-2 hitl setup and sets the GitHub default branch to `main`, then runs the story's Verify.

