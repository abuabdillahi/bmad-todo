---
id: 15
type: bug
title: "A burst of merges can leave the tip of main undeployed"
covers: []
after: [8]
assignee: ""
refined: true
hitl: false
risk: high
severity: P3
tracker_id: "26"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/26"
tracker_status: in-progress
parent: epic-manage-todos
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

## Acceptance Criteria

1. **Production catches up with main's tip without a push** (R22)
   **Given** main's tip is a commit that production does not run and is not older than what production runs (its deploy was cancelled in the `deploy-prod` group, or its push never produced a run, as on 2026-11-25 when a GitHub incident left merge ea86627 with no run)
   **When** the scheduled check runs (proposal in the 2.8 security report: every 30 minutes)
   **Then** it reads the SHA production runs the way the deploy guard does, and when main's tip is newer it tests and deploys the tip through the same `test` and `deploy` jobs and the public health check; when production already runs the tip, or a newer commit, it deploys nothing and says so in the run
2. **Nothing else about deploys changes**
   **Given** a push to main, a branch push, or a manual rollback run
   **When** the workflow runs
   **Then** it behaves exactly as before: tests on every push, deploys on main only after a green test, a rollback deploys the given SHA's GHCR images, and the deploy guard still keeps a newer live SHA
3. **The check is proven before it reaches main**
   **Given** the branch's CI
   **When** it runs
   **Then** the new decision logic (tip newer, equal, older; no run; cancelled deploy) is covered by a test the branch runs (for example a script with its own unit test, or `actionlint` plus a dry-run of the decision step), since the deploy job itself only runs on main

## Boundaries

- Must not change: the secrets, the host, the Cloudflare tunnel, how images are built and tagged, or the rollback procedure; no new secret.
- Never: deploy a commit that is not on main, or one older than what production runs.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-green-push-to-main-deploys-the-tested-images-behind-the-cl-plan.md, Review Triage Log #1 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-18

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, user: This bug moves into epic-manage-todos (entry 15) and is built before the epic closes; the user authorised the change to the workflow's deploy job (answer to the security review's proposal, story 8, #49).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Built in one lane with 16 and 17, which also change `.github/workflows/ci.yml`, after story 8; risk high, because a broken deploy job is only seen on main.
- Decision: 2026-11-25, po (hands-off run on the user's instruction), settling the build's intent gap (plan review, 2026-11-25): (1) a `[skip ci]` commit needs no deploy (AGENTS.md: those pushes get no CI and no deploy), so the check does nothing when every commit since production's SHA carries a skip token, and otherwise judges the newest commit without one; (2) the check deploys only the two cases criterion 1 names, a deploy cancelled by the `deploy-prod` concurrency group and a push with no run on main; any other cancelled test or deploy is taken as deliberate and is not deployed, only reported in the run's notice, and a cancellation the check cannot attribute to the group counts as deliberate. No kill switch is added. Chosen as the safest option: it never deploys what a person stopped and needs no new setup.
