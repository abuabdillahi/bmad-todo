---
id: 5
type: bug
title: "A manual deploy run from a branch other than main silently does nothing"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "27"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/27"
tracker_status: backlog
---

# A manual deploy run from a branch other than main silently does nothing

## Description

Rollback is the deploy run by hand (`workflow_dispatch`) with an earlier SHA (AD-18). If a person starts that run from a branch other than `main`, every job is skipped and the run looks finished, so the rollback silently does not happen. The run should either deploy or fail with a message saying why it did not.

## Reproduction

1. In GitHub Actions, run the CI workflow by hand with an earlier SHA, choosing a branch other than `main` in the branch dropdown.
2. Actual: every job is skipped, nothing deploys, and nothing says so. Expected: the rollback deploys, or the run fails with a clear reason.

## Cause Hypothesis

The deploy job's `if` condition only allows `main`, and nothing reports a skipped manual run as a failure. `main` being the default branch makes it rare, since the dropdown defaults to it.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-green-push-to-main-deploys-the-tested-images-behind-the-cl-plan.md, Review Triage Log #4 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-18 (rollback)

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
