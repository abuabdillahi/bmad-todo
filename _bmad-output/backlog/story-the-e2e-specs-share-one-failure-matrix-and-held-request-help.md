---
id: 17
type: story
title: "The e2e specs share one failure matrix and held-request helper"
after: []
hitl: false
risk: low
tracker_id: "77"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/77"
tracker_status: backlog
---

# The e2e specs share one failure matrix and held-request helper

## Description

Retrospective A9 (F2, R7): the [503 problem, no response] failure matrix is copied in five e2e specs and the held-PATCH setup in two; they move into e2e/helpers.ts. The e2e quoteText helper (and its copy in e2e/a11y/keyboard-pass.mjs) still cuts by code point and should cut on whole characters as quote() does. Test only.

## Requirements

Verify: The five specs and two held-PATCH blocks use helpers from e2e/helpers.ts, quoteText cuts on whole characters, and pnpm test:all passes with the same scenarios listed.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings F2 and R7; Action items A9

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A9).
