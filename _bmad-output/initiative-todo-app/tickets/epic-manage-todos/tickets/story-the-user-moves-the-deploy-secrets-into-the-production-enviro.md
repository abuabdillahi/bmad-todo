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
