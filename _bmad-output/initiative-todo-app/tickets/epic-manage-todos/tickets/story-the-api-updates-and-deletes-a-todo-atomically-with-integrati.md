---
id: 2
type: story
title: "The API updates and deletes a todo, atomically, with integration and contract tests"
parent: epic-manage-todos
covers: [R10, R11, R12, R17, R20]
after: [1.3, 1.7]
hitl: false
risk: medium
tracker_id: "43"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/43"
tracker_status: backlog
---

# The API updates and deletes a todo, atomically, with integration and contract tests

## Description

Adds PATCH /api/todos/{id} (description, completed, or both) and DELETE /api/todos/{id} to the contract, openapi.json and the API, with AD-8's strict validation on update, 404 for an unknown id, AD-15's one-statement writes and a storage failure answered as unavailable, as list and create do; delivers I12 and I13 for both routes and re-tags the existing header and log tests that borrow I8, I2, I10 and I7 to I12 and I13. The web stories 3, 4 and 5 call these routes.

## Requirements

Verify: pnpm test:all passes and lists passing tests for I4, I5, I12 and I13 and for the update and delete parts of I8, I9 and I11. With the test profile up, PATCH http://127.0.0.1:8081/api/todos/<id> with {"completed":true} answers 200 with the todo completed, DELETE answers 204 and then 404, and a PATCH with {} answers a validation problem.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: I4, I5 whole; I8 for update; I9 for every PATCH and DELETE response (200, 204, 400, 404, 503); I11 update half (unknown field, null, wrong type, empty body, control characters); I12 for the new routes and nginx's 503 on them; I13 for update and delete, refused and failed ones included; the re-tag of the existing tests that borrow I8 (security headers) and I2, I10, I7 (no todo text in logs)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-5 (schemas in packages/contract, openapi.json regenerated and committed), AD-6 (PATCH and DELETE rows; 503 documented on every route), AD-8 (server side, on edit), AD-9 (problem types; storage failure is unavailable on the todo routes), AD-10 (service owns existence), AD-12, AD-15 (one statement or one transaction, the persisted row returned), AD-19, AD-20 (contract and contract-unavailable suites, with headers)

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): test-strategy.md gains I12 (security headers) and I13 (no todo text in logs). This story, the first that touches the tests that borrowed other ids for them, re-tags them: the header tests in `apps/api/test/profile/headers.profile.test.ts` and `apps/api/test/unavailable/api-down.contract.test.ts` (I8) become I12, and the log tests in `apps/api/test/integration/logs.test.ts` (I2, I10, I7) and `apps/api/test/profile/logs.profile.test.ts` (none) become I13. Genuine I2, I7, I8 and I10 tests keep their ids.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): A storage failure on update or delete answers `503` unavailable, as list and create do since #32 (AD-9, amended 2026-11-25).
