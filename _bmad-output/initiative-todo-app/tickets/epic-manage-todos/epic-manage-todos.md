---
type: epic
title: "A user manages their whole list, instantly, on any device"
parent: initiative-todo-app
covers: [R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R17, R18, R19, R20]
sources: []
companions: []
after: []
refined: false
risk: medium
---

# A user manages their whole list, instantly, on any device

## Description

This epic completes the core loop of the Todo App initiative on top of epic 1's foundation. A user edits, completes, reactivates and deletes todos, and each change persists through endpoints with integration and contract tests. Every action shows at once and reverts with a message if saving fails, reusing epic 1's optimistic-update pattern. Completed todos look distinct, and the empty, loading and error states appear when they should. All of it works on phone and desktop and meets WCAG 2.2 AA. The epic closes the app's quality record with the whole-app audits and reviews, and it ships through epic 1's pipeline.

## Outcome

A user manages their whole list without guidance on any device, and it never loses their work.

## Done when

- On the deployed app, a user edits, completes, reactivates and deletes todos. Each change shows at once and persists after a refresh, a new session and a server restart, and an invalid edit is refused with a clear message.
- Playwright journeys for create, complete, delete, edit, the empty state and error handling pass at phone and desktop widths and by keyboard, with no axe-core AA violations.
- Completed todos look distinct from active ones. With the API slow, failing or unreachable, the loading and error states show, each action reverts with a message, and the list stays usable.
- The whole-app Lighthouse audit and a manual keyboard and screen-reader pass find no WCAG 2.2 AA failures.
- Documented under `docs/quality/`, with every finding fixed or accepted: a performance profile of each action against C4's 100 ms target, the final whole-app coverage report, and a security review covering XSS in rendered and edited text. Everything is deployed by the CI pipeline.

## Boundaries

- Belongs to epic-todo-foundation: the Docker, compose, CI and deploy setup, the test harness, the create and list endpoints, and optimistic add. This epic uses them and changes them only where its own actions need it.
- Owns, in its share of shared ids: update and delete (R10), persistence of completion, edits and deletions (R11), edit validation, atomic update and delete, and client handling of failed saves (R12), and optimistic edit, complete and delete (R7).
- Must not change: create and list behaviour, the API contract for create and list, and the health checks, all as epic 1 delivers them.

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R4–R14, R17–R20) and Constraints (C1–C12)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 2 (the split of each shared id and scenario)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U3, I4, I5, K2–K5, E2–E6, and the update/delete part of I8, I9, K6, E7, E8)

## Notes

- Waits on epic-todo-foundation because: it needs the deployed create and list API and its contract, the data model and storage, the optimistic-update pattern, the compose profiles, the test harness, CI and automated deploy, and the list UI.
- Open question: This epic may run to about 13 stories, past the usual 8–12. Whether to split it is decided when it is refined.
