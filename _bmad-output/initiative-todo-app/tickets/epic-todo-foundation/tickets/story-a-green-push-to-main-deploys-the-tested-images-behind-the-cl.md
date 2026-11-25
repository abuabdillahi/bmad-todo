---
id: 2
type: story
title: "A green push to main deploys the tested images behind the Cloudflare Tunnel"
parent: epic-todo-foundation
covers: [R15, R16, R21, R22]
after: [1]
hitl: true
risk: medium
tracker_id: "5"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/5"
tracker_status: done
---

# A green push to main deploys the tested images behind the Cloudflare Tunnel

## Description

After a person sets up the GitHub secrets, the Hetzner bootstrap and the Cloudflare Tunnel, one GitHub Actions workflow builds both images at the git SHA and runs pnpm test:all on every push, and on a green main pushes them to GHCR and deploys them over SSH to the Hetzner host under the prod profile, with cloudflared as the only ingress, the host .env rewritten from GitHub secrets, and the public health check; it deploys story 1's app, and story 7 adds log rotation to its prod services.

## Requirements

Verify: Push to main: the commit shows the test job then the deploy job green, the running images are tagged with that commit's SHA, and at the public hostname a todo added in the browser is still there after a refresh and /api/health answers ok. Push a failing commit to main, then revert it: its test job is red, its deploy is skipped and production still serves the earlier SHA. Run the workflow by hand with an earlier SHA: production rolls back to it.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-1, AD-2 (never down -v in prod), AD-3, AD-5 (CI fails when regenerating openapi.json makes a diff), AD-16 (prod profile, project todo), AD-17 (health checks and restart policy for web and cloudflared), AD-18 (test then deploy, concurrency deploy-prod, workflow_dispatch rollback with an earlier SHA), AD-19 (secrets only in GitHub, host .env generated with mode 600, no registry credential on the host); Structural Seed (Environments and deployment); Deferred (public hostname, tunnel token, deploy user and key)
- initiative — _bmad-output/initiative-todo-app/initiative-todo-app.md: Boundaries, touch points GitHub, Hetzner host, GHCR and Cloudflare
