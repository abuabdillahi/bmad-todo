---
id: 10
type: bug
title: "A storage failure on list or create reports an internal error, not unavailable"
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "32"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/32"
tracker_status: done
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

## Acceptance Criteria

1. **A list that cannot reach storage reports unavailable** (R12, R15; AD-9)
   **Given** the API's storage cannot be reached (its database connection is closed, as in I7's unhealthy case)
   **When** a client sends `GET /api/todos`
   **Then** the response is `503` with exactly the `unavailable` problem that `/api/health` returns in the same state
   **And** the response validates against `openapi.json` (I9)
2. **A create that cannot reach storage reports unavailable and stores nothing** (R12; AD-9, AD-15)
   **Given** storage cannot be reached, or refuses writes (for example, the database file is read-only)
   **When** a client sends a valid `POST /api/todos`
   **Then** the response is `503` with the `unavailable` problem, valid against `openapi.json` (I9)
   **And** no todo is stored: with a read-only database file, a list afterwards does not hold it
3. **A failure that is not a storage failure still reports internal** (AD-9)
   **Given** list or create fails with an error that does not come from storage, caused in-process through the integration harness and never through a test-only route (AD-20)
   **When** the request is answered
   **Then** the response is `500` with the `internal` problem, as before
4. **A storage failure is logged without todo text** (AD-17, AD-19)
   **Given** criterion 1 or 2
   **When** the API logs the failure
   **Then** it logs at `warn`, as health does, and adds no todo text of its own. Ticket #35 proves, across every failed create, that no log line holds todo text
5. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** integration tests, each titled with its scenario id, fail on the current code and pass on the fix for criteria 1–3
6. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** list and create already answer `503 unavailable`, with the evidence recorded in Notes; this supersedes 1–5

## Boundaries

- Must not change: `/api/health`'s responses (I7), the `validation` and `conflict` responses of create (I2, I10, I11), the fixed problem bodies (no stack, SQL or todo text), or `openapi.json`, which already documents `503` on both routes.
- Must not change: the web client. Its existing `unavailable` message ("The server isn't available right now. Try again in a moment.") now applies to these failures with no client change.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R4 (deferred) and action item A6. It comes from the retrospective's own review, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-9 (problem types: `unavailable` means the service can't serve the request now), AD-10 (layering), AD-15 (atomic writes), AD-17 (health) and AD-19 (logs)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md, I7 and I9

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, po: AD-9 defines `unavailable` as "the service can't serve the request now"; its examples name only `/api/health` and nginx, and `openapi.json` already documents `503` on list and create. This ticket needs no architecture change. Naming list and create in AD-9 is optional, for the architect at the next amendment.
- Handoff with #35, built in parallel: this ticket sets how a storage failure on create is answered and logged; #35's criterion 3 proves that no log line from a failed create holds todo text, whatever this ticket logs. Both may touch the API's error handler; #32 merges first and #35 rebases on it.
- Where the finding pointed: `apps/api/src/problems.ts:95-104` and `apps/api/src/routes/health.ts:26-30`.
