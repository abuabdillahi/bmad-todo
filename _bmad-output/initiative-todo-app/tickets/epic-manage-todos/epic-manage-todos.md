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

This epic completes the core loop of the Todo App initiative on top of epic 1's foundation. A user edits, completes, reactivates and deletes todos, with each delete confirmed inline in its card, and each change persists through the `PATCH` and `DELETE` endpoints, which have integration and contract tests (AD-6, AD-15). Every action shows at once and reverts with a message if saving fails, through AD-13's mutation helper and AD-14's announcer, both built in epic 1. Completed todos look distinct, as the `bmad-ux` design specifies, and the empty, loading and error states appear when they should (AD-11). All of it works on phone and desktop and meets WCAG 2.2 AA. The epic closes the app's quality record with the whole-app audits and reviews, and it ships through epic 1's pipeline.

## Outcome

A user manages their whole list without guidance on any device, and it never loses their work.

## Done when

- On the deployed app, a user edits, completes, reactivates and deletes todos. Delete opens an inline confirm and sends nothing until the user confirms, with no undo. Each change shows at once and persists after a refresh, a new session and a server restart, and an invalid edit is refused with a clear message.
- Playwright journeys for create, complete, delete, edit, the empty state and error handling pass at phone and desktop widths and by keyboard, with no axe-core AA violations.
- Completed todos look distinct from active ones, and recede, in both light and dark modes. With the API slow, failing or unreachable, the loading and error states show, each action reverts with a message, and the list stays usable.
- The whole-app Lighthouse audit and a manual keyboard and screen-reader pass find no WCAG 2.2 AA failures.
- Documented under `docs/quality/`, with every finding fixed or accepted: a performance profile of each action against C4's 100 ms target, the final whole-app coverage report, and a security review covering XSS in rendered and edited text. Everything is deployed by the CI pipeline.

## Boundaries

- Belongs to epic-todo-foundation: the Docker, compose, CI and deploy setup, the test harness, the create and list endpoints, optimistic add, the `Problem` schema and its type URIs, the mutation helper, the announcer, AD-11's todos store, query function, list-state selector and query policy (with the refresh-failure announcement), and the design tokens for both colour modes. This epic renders the empty, loading and error states and the Loading status from that selector (K5; epic-todo-foundation Notes, decision 2026-11-24). This epic uses them and changes them only where its own actions need it.
- Owns, in its share of shared ids: update and delete (R10), persistence of completion, edits and deletions (R11), edit validation, atomic update and delete, and client handling of failed saves (R12), and optimistic edit, complete and delete (R7).
- Reuses, never duplicates: AD-13's mutation helper for every edit, complete and delete, and AD-14's announcer and `messages.ts` for every outcome message. It adds no second optimistic path, toast or alert, and no problem type outside AD-9's closed set.
- Must not change: create and list behaviour, the API contract for create and list, and the health checks, all as epic 1 delivers them.

## References

- parent — _bmad-output/initiative-todo-app/initiative-todo-app.md, section Requirements (R4–R14, R17–R20) and Constraints (C1–C12)
- breakdown — _bmad-output/initiative-todo-app/tickets/tickets.toml, epic 2 (the split of each shared id and scenario)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-6–AD-9, AD-11, AD-13–AD-15, AD-19, AD-20, and Deferred (R6, R8 to `bmad-ux`)
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md (U3, I4, I5, K2–K5, E2–E5, the update/delete part of I8, I9, I11, K6, E6, E7, E8, and U5's edit, complete and delete half)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/DESIGN.md and EXPERIENCE.md (the Todo card, Edit form, Delete confirm, list states, focus rules and completed styling this epic builds)

## Notes

- Waits on epic-todo-foundation because: it needs the deployed create and list API and its contract, the data model and storage, AD-13's mutation helper with AD-11's todos store and AD-14's announcer, the DESIGN.md tokens for light and dark modes, the compose profiles, the test harness, CI and automated deploy, and the list UI.
- Open question: This epic may run to about 13 stories, past the usual 8–12. Whether to split it is decided when it is refined.
- Decision: 2026-11-24, user: Delete confirms inline in the card ("Delete this todo?" with Delete and Cancel), with no undo, for WCAG 3.3.4 (initiative Notes). K4 and E3 now include the confirm step, and the `DELETE` endpoint and AD-13's helper are unchanged.
- Decision: 2026-11-24, user: Light and dark modes are in v1, following the system setting. Completed todos must recede in both (initiative Notes; EXPERIENCE, Inspiration & Anti-patterns).
- Decision: 2026-11-24, po: This epic's share of the test-strategy updates: K3's paste and counter case, K4 and E3's confirm step, every K5 case, and I11's control-character rejection on update (spine AD-8, AD-11, AD-14).
- Decision: 2026-11-24, po: E6 is split by action. This epic owns its edit, complete and delete part and the list's error-state part, and epic 1 owns the add part.
