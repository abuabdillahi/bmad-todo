---
id: 13
type: story
title: "The logs are proven to hold no todo text on failed requests too"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
tracker_id: "35"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/35"
tracker_status: backlog
---

# The logs are proven to hold no todo text on failed requests too

## Description

AD-19 says the API's logs never contain todo text. The profile test proves it only for a successful create and list. A refused create (validation, conflict) and an unhandled error log more, including the error itself, and nothing checks that the submitted text stays out of those lines.

## Requirements

Verify: `pnpm test:all` passes, and its profile step sends a create refused for validation, a create that conflicts, and one that fails on the server, each carrying a unique marker in its text, and fails if any `api` log line contains a marker.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R8 ("Defer the error-path log test"). It comes from the retrospective, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-17 (logs), AD-19 (no todo text in logs) and AD-20 (Profile tests)

## Notes

- Decision: 2026-11-25, user: This deferred test moves to the backlog after epic-todo-foundation's closure. The README's wording about log lines is backlog id 3 (#25).
- Open question: How to cause a server-side failure without a test-only route (AD-20 forbids them), for example by making the database read-only. Answered in the work.
- Where the finding pointed: `apps/api/test/profile/logs.profile.test.ts:9-31`.
