---
id: 13
type: story
title: "The logs are proven to hold no todo text on failed requests too"
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
tracker_id: "35"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/35"
tracker_status: in-progress
---

# The logs are proven to hold no todo text on failed requests too

## Description

AD-19 says the API's logs never contain todo text. The profile test proves it only for a successful create and list. An unavailable or unhandled error also logs the error object, and refused creates (validation, conflict) are simply untested, so nothing checks that the submitted text stays out of those lines.

## Requirements

1. **A refused create leaves no todo text in the logs** (R20; AD-19)
   **Given** the API is running with its normal logging
   **When** a create is refused for validation, with a unique marker in its description (for example, a description over 200 characters)
   **Then** no line the API logs contains the marker
2. **A conflicting create leaves no todo text in the logs** (R20; AD-6, AD-19)
   **Given** a stored todo
   **When** a create reuses its id with a different description carrying a unique marker
   **Then** no line the API logs contains the marker
3. **A create that fails on the server leaves no todo text in the logs** (R20; AD-19)
   **Given** the API cannot store todos (for example, its storage is unreachable or read-only)
   **When** a valid create carrying a unique marker fails
   **Then** no line the API logs contains the marker. The test does not assert the status code, which ticket #32 changes from `500` to `503` in parallel.
4. **A failing case is a real defect**
   **Given** a criterion above fails because a log line holds todo text
   **When** the work goes on
   **Then** the logging is fixed so AD-19 holds, and the plan says which line leaked
5. **The tests follow AD-20**
   **Given** the new tests
   **When** `pnpm test:all` runs, locally and in CI
   **Then** they pass, each title starts with a scenario id, and the app gains no test-only route or flag

## Boundaries

- Must not change: any response; this ticket changes none (#32 changes the storage-failure responses in parallel). Must not change the log format AD-17 sets (JSON lines with a UUID `reqId`). The existing success-path log test keeps passing.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R8 ("Defer the error-path log test"). It comes from the retrospective, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-17 (logs), AD-19 (no todo text in logs) and AD-20 (Profile tests)

## Notes

- Decision: 2026-11-25, user: This deferred test moves to the backlog after epic-todo-foundation's closure. The README's wording about log lines is backlog id 3 (#25).
- Open question: Where each case runs, without a test-only route (AD-20): in the container, reading the `api` logs as the profile test does, or in-process through the integration harness with the API's log output captured, as I7's closed handle allows for the server failure. Either proves "no line the API logs". Answered in the plan.
- Handoff with #32, built in parallel: #32 sets how a storage failure on create is answered and logged; this ticket proves no log line holds todo text whatever it logs. #32 merges first; this ticket rebases on it.
- Where the finding pointed: `apps/api/test/profile/logs.profile.test.ts:9-31`.
