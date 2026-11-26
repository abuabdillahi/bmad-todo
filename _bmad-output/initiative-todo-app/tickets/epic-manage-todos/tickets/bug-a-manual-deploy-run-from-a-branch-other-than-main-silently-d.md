---
id: 16
type: bug
title: "A manual deploy run from a branch other than main silently does nothing"
covers: []
after: [15]
assignee: ""
refined: true
hitl: false
risk: medium
severity: P3
tracker_id: "27"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/27"
tracker_status: done
parent: epic-manage-todos
---

# A manual deploy run from a branch other than main silently does nothing

## Description

Rollback is the deploy run by hand (`workflow_dispatch`) with an earlier SHA (AD-18). If a person starts that run from a branch other than `main`, every job is skipped and the run looks finished, so the rollback silently does not happen. The run should either deploy or fail with a message saying why it did not.

## Reproduction

1. In GitHub Actions, run the CI workflow by hand with an earlier SHA, choosing a branch other than `main` in the branch dropdown.
2. Actual: every job is skipped, nothing deploys, and nothing says so. Expected: the rollback deploys, or the run fails with a clear reason.

## Cause Hypothesis

The deploy job's `if` condition only allows `main`, and nothing reports a skipped manual run as a failure. `main` being the default branch makes it rare, since the dropdown defaults to it.

## Acceptance Criteria

1. **A manual run from another branch fails with the reason**
   **Given** a person starts the CI workflow by hand (`workflow_dispatch`) from a branch other than `main`
   **When** it runs
   **Then** a job fails with an `::error::` saying rollback runs only from `main` and to choose `main` under "Use workflow from", and nothing deploys
2. **Rollback from main is unchanged**
   **Given** a manual run from `main` with an earlier deployed SHA
   **When** it runs
   **Then** it deploys that SHA's images exactly as the README's Roll back section says, and push runs on any branch are unchanged
3. **Tested before main**
   **Given** the branch's CI
   **When** it runs
   **Then** the workflow passes `actionlint` (or the repo's workflow check) and the new job's condition is shown to run only for a manual run off `main`

## Boundaries

- Must not change: the deploy steps themselves, the secrets, the host or the tunnel.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-green-push-to-main-deploys-the-tested-images-behind-the-cl-plan.md, Review Triage Log #4 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-18 (rollback)

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, user: This bug moves into epic-manage-todos (entry 16) and is built before the epic closes; the user authorised the change to the workflow (answer to the security review's proposal, story 8, #49).
