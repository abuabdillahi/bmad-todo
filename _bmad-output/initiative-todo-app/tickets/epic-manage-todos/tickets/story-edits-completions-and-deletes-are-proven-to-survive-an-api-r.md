---
id: 22
type: story
title: "Edits, completions and deletes are proven to survive an API restart"
parent: epic-manage-todos
covers: [R11, R17]
after: []
refined: true
hitl: false
risk: low
tracker_id: "73"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/73"
tracker_status: backlog
---

# Edits, completions and deletes are proven to survive an API restart

## Description

R11 and the epic's Done when say completion, edits and deletions survive a server restart, but the restart test I6 creates a todo, restarts the `api` container and checks only that todo. Story 3's review inferred the rest from the shared SQLite path; the retrospective (F4, action A4) calls this a verification gap, not a suspected defect. This story extends I6 to prove it. Test only.

## Requirements

1. **An edit and a completion survive a restart** (R11)
   **Given** the I6 profile test, with one todo created, its text changed by `PATCH` and then marked completed
   **When** the `api` container restarts and the list is read again
   **Then** that todo is listed with its new text and `completed: true`
2. **A delete survives a restart** (R11)
   **Given** a second todo created and then deleted (`204`) before the restart
   **When** the list is read after the restart
   **Then** it is absent, and a `PATCH` or `DELETE` on its id answers `404`
3. **The test is I6 and fails on a lost change** (R17)
   **Given** `pnpm test:all`
   **When** it runs
   **Then** it passes and lists the extended test under I6; the plan records that the test failed when its assertions were pointed at the pre-change values

## Boundaries

- Must not change: app code, the restart mechanism I6 already uses, or the existing created-todo check.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md, R11 and Done when
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md, Aggregate view, finding F4; Action items A4
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md, I6

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): from the retrospective's action item A4, fixed in this epic on a fix branch through the full gate.
- Risk low: test only; if a change does not survive the restart, that is a new high-risk bug, filed separately.
