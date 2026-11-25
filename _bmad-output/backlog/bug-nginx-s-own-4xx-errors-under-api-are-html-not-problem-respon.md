---
id: 6
type: bug
title: "nginx's own 4xx errors under /api are HTML, not problem responses"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
---

# nginx's own 4xx errors under /api are HTML, not problem responses

## Description

When nginx itself refuses a request under `/api/`, for example a body over 1 MiB (413) or a malformed percent-encoding in the path (400), it answers with its own HTML page instead of an `application/problem+json` body (AD-9). The app's client never sends such requests, and it classifies the response as a generic failure, so nothing breaks today; any other API client gets HTML.

## Reproduction

1. With the test profile up, send `POST /api/todos` through `web-test` with a JSON body over 1 MiB.
2. Actual: `413` with an HTML body. Expected: a problem response, as every other `/api` error is.

## Cause Hypothesis

AD-4 scopes nginx's problem body to upstream failures (502, 503, 504) only; nginx's own 4xx responses have no error-page mapping under `/api/`.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-api-refuses-an-invalid-or-conflicting-create-with-a-prob-plan.md, Review Triage Log, 2026-11-25 review pass, finding 3 of 3 (rejected: real, more than a direct correction)
- report — docs/quality/2026-11-25-epic-todo-foundation-security.md, finding S3 (accepted)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-4 and AD-9

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6). Security report S3 accepted it; this ticket is where fixing it would be planned.
