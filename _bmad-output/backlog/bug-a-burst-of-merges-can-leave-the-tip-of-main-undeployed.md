---
id: 4
type: bug
title: "A burst of merges can leave the tip of main undeployed"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "26"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/26"
tracker_status: backlog
---

# A burst of merges can leave the tip of main undeployed

## Description

When three pushes to `main` land close together and their test jobs finish out of order, the newest commit's deploy can be cancelled. Production then stays on an older green commit until the next push, and the tip's run shows as cancelled. Every green push to `main` should end with production on the newest green commit (R22).

## Reproduction

1. Push three commits to `main` (M1, M2, M3) in quick succession.
2. Let M3's test job finish before M2's (M3 before M2).
3. Actual: M2's queued deploy replaces M3's pending one in the `deploy-prod` concurrency group; M3 never deploys and its run shows cancelled. Expected: M3, the tip, is what production runs.

## Cause Hypothesis

GitHub Actions keeps only one pending job per concurrency group, so a later-queued deploy for an older commit replaces the pending deploy for a newer one. The deploy guard then skips nothing, because the older commit is still newer than what is running.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-green-push-to-main-deploys-the-tested-images-behind-the-cl-plan.md, Review Triage Log #1 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-18

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
