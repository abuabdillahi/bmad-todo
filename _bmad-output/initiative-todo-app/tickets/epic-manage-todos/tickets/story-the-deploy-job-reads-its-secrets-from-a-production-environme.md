---
id: 17
type: story
title: "The deploy job reads its secrets from a production environment limited to main"
parent: epic-manage-todos
covers: [R20]
after: [16]
refined: true
hitl: false
risk: medium
tracker_id: "64"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/64"
tracker_status: in-progress
---

# The deploy job reads its secrets from a production environment limited to main

## Description

The 2.8 security review (docs/quality/2026-11-25-epic-manage-todos-security.md, S10) found that the deploy job's secrets (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `TUNNEL_TOKEN`) are repository secrets, which a workflow change on any branch could read. This story puts the `deploy` job in a GitHub environment named `production`; entry 18 is the user moving the secrets into it, limited to `main`.

## Acceptance Criteria

1. **The deploy job runs in the production environment** (R20)
   **Given** a push to main or a manual rollback run from main
   **When** the `deploy` job runs
   **Then** it runs with `environment: production`, reads the same five secrets and `PUBLIC_HOSTNAME`, and deploys and passes the public health check exactly as before, whether the secrets are still repository secrets or already the environment's
2. **No other job can reach the deploy secrets once they move**
   **Given** the workflow
   **When** it is read
   **Then** only `deploy` (and any job entry 15 adds that reads production, which also runs in `production`) names `environment: production` or reads those secrets
3. **The move is documented for the person who does it**
   **Given** README's setup section
   **When** a person reads it
   **Then** it says the five secrets live in the `production` environment, with deployment branches limited to `main`, and gives the steps entry 18 follows: set the branch rule, add the secrets, delete the repository secrets, re-run the last main deploy

## Boundaries

- Must not change: any secret's value or name, the host, the Cloudflare tunnel, or the deploy steps beyond adding the environment.
- The agent never creates, reads or deletes a secret or changes repository settings; entry 18 is the user's.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — docs/quality/2026-11-25-epic-manage-todos-security.md, finding S10
- code — `.github/workflows/ci.yml` (`deploy`), README (setup, Roll back)

## Notes

- Decision: 2026-11-25, user: S10 is built in this epic; the user authorised the deploy-job change and will move the secrets themselves (entry 18).
