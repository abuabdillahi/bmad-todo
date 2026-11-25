---
id: 10
type: bug
title: "A storage failure on list or create reports an internal error, not unavailable"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
---

# A storage failure on list or create reports an internal error, not unavailable

## Description

When the API cannot reach its storage, `/api/health` answers 503 `unavailable`, but a list or create in the same moment answers 500 `internal`. The user then reads "something went wrong on our side" while the service is in fact unavailable, and the two endpoints disagree about the same failure.

## Reproduction

1. With the test profile up, make the API's SQLite file unreadable or unwritable.
2. Call `GET /api/health`, then `GET /api/todos` and `POST /api/todos` with a valid body.
3. Actual: health answers 503 with the `unavailable` problem; list and create answer 500 with the `internal` problem. Expected: all three report the storage failure the same way.

## Cause Hypothesis

Only the health route wraps storage errors as an unavailable error; on list and create they reach the error handler as unhandled errors, which map to `internal`.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R4 (deferred) and action item A6. It comes from the retrospective's own review, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-9 (problem types) and AD-17 (health)

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Where the finding pointed: `apps/api/src/problems.ts:95-104` and `apps/api/src/routes/health.ts:26-30`.
