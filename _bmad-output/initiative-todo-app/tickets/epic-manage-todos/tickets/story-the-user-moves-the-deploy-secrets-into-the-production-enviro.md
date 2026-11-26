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
tracker_status: done
---

# The user moves the deploy secrets into the production environment

## Description

The person with admin rights sets the production environment's deployment branches to main only, adds DEPLOY_SSH_KEY, DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS and TUNNEL_TOKEN to it, deletes the repository secrets of those names, and re-runs the last main deploy to prove it still deploys.

## Requirements

Verify: The production environment lists the five secrets and only main may deploy to it; the repository secrets are gone; a main deploy run after the move passes its public health check.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md

## Notes

- Decision: 2026-11-25, user: The user moves the deploy secrets into the `production` environment after story 17 ships, as the security review's S10 proposed. No agent creates, reads or deletes a secret.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The epic's closing stories do not wait on this entry; until it is done, the secrets stay repository secrets and deploys keep working. (Corrected 2026-11-26: this part was po's choice, first written inside the user's line above.)
- Decision: 2026-11-26, po (hands-off run on the user's instruction): "re-run the last main deploy" means redeploy the SHA production runs now, as README's Required GitHub settings says (re-run its push run if under a day old, otherwise run the workflow by hand on main with that SHA). Re-running the newest push run could undo a live rollback (story 17's review, PR #69). The `production` environment exists since main run 45727428285, with no rules or secrets yet; deploys read the repository secrets until the move.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): from epic-manage-todos' retrospective, action item A17 (D1, D8): add no required reviewers or wait timer to `production` while the half-hourly `catch-up` job names that environment, or every scheduled run waits for approval. No new ticket.
- Decision: 2026-11-26, po (hands-off run on the user's instruction): once this move is done, a docs-only fix puts README's secrets text and the security report's S10 into the present tense ("live in production", S10 fixed); it is filed when the user reports the move.
- Result: 2026-11-26, user, verified by the orchestrator with read-only calls: environment `production` allows deployment from branch `main` only (custom branch policy, no required reviewers or wait timer) and holds the five secrets (set 01:26-01:32Z); the repository has no secrets left (`PUBLIC_HOSTNAME` stays a repository variable). Redeploy of b167cfe, the SHA production ran (no rollback live): main run 45727428285 attempt 2 failed at "Copy compose.yml and write the host .env", before `DEPLOY_KNOWN_HOSTS` was re-set at 01:32:51Z; attempt 3 (job 139631281783, 01:34Z) passed every step, including the public /api/health check. Done.
- Decision: 2026-11-26, po on the user's instruction: the docs-only fix the Decision above promised is folded into PR #87 (README) and the closing-reports PR (security report S10), with no new ticket.
