---
id: 18
type: story
title: "The user moves the deploy secrets into the production environment"
parent: epic-manage-todos
covers: [R20]
after: [17]
hitl: true
risk: medium
tracker_id: "65"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/65"
tracker_status: backlog
---

# The user moves the deploy secrets into the production environment

## Description

The person with admin rights sets the production environment's deployment branches to main only, adds DEPLOY_SSH_KEY, DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS and TUNNEL_TOKEN to it, deletes the repository secrets of those names, and re-runs the last main deploy to prove it still deploys.

## Requirements

Verify: The production environment lists the five secrets and only main may deploy to it; the repository secrets are gone; a main deploy run after the move passes its public health check.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md

## Notes

- Decision: 2026-11-25, user: The user moves the deploy secrets into the `production` environment after story 17 ships, as the security review's S10 proposed. No agent creates, reads or deletes a secret. The epic's closure does not wait on it; until it is done, the secrets stay repository secrets and deploys keep working.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): "re-run the last main deploy" means redeploy the SHA production runs now, as README's Required GitHub settings says (re-run its push run if under a day old, otherwise run the workflow by hand on main with that SHA). Re-running the newest push run could undo a live rollback (story 17's review, PR #69). The `production` environment exists since main run 45727428285, with no rules or secrets yet; deploys read the repository secrets until the move.
