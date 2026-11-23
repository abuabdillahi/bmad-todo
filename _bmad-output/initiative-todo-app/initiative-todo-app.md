---
id:
type: initiative
title: "Individuals manage personal todos in a simple, durable full-stack app"
sources: ["_bmad-output/initiative-todo-app/prd-todo-app.md"]
companions: []
after: []
risk: low
---

# Individuals manage personal todos in a simple, durable full-stack app

## Description

A first version of a full-stack Todo app, built from the PRD in `prd-todo-app.md`: one person opens it, sees their list, and adds, edits, completes and deletes tasks with no guidance, and the list is still there after a refresh, a new session or a server restart. The scope is deliberately minimal — the core loop done well, on a foundation a future developer can extend with accounts and more features.

## Outcome

An individual can manage their personal tasks without any onboarding and trust that the list persists, measured by users completing every core action unguided and the app staying stable across refreshes and sessions.

## Requirements

- R1 (prd ¶2): A user creates a todo by entering a short text description; it appears in the list.
- R2 (prd ¶2): Every todo carries its description, a completion status, and its creation time.
- R3 (prd ¶2): Opening the app shows the user's todo list straight away, with no onboarding or explanation.
- R4 (prd ¶2): A user marks a todo complete and can return it to active.
- R5 (prd ¶2): A user deletes a todo; it leaves the list and does not come back on refresh.
- R6 (prd ¶3): Completed todos look visibly different from active ones at a glance.
- R7 (prd ¶3, ¶5): Add, complete and delete show in the list immediately, without waiting on the server; a failed save reverts the change and says so.
- R8 (prd ¶3): Every action works on desktop and mobile screen widths.
- R9 (prd ¶3): The list shows a distinct empty state, loading state, and error state, each when its condition holds.
- R10 (prd ¶4): A backend API creates, lists, updates and deletes todos.
- R11 (prd ¶4, ¶7): Todos and their status survive a page refresh, a new browser session, and a server restart.
- R12 (prd ¶4, ¶5): The API rejects invalid input with a clear error and never leaves a todo half-written; the client shows failures without losing the list or blocking further use.
- R13 (prd ¶4; decision 2026-11-23): A user edits a todo's description; the new text shows in the list and persists, under the same rules as create.
- R14 (prd ¶3; decision 2026-11-23): Every action can be done by keyboard alone, and a screen reader announces each control and each todo's status.

## Constraints

- C1 (prd ¶4): No authentication or multi-user support in v1, but the data model and API must allow adding an owner to todos, and auth, later without a rewrite.
- C2 (prd ¶1, ¶4): Full-stack: a frontend client backed by a server API with durable server-side storage; browser-only storage does not meet R11.
- C3 (prd ¶1, ¶5): Favour simplicity and maintainability: the fewest moving parts, easy for a new developer to understand, run, deploy and extend.
- C4 (prd ¶5): Interactions feel instantaneous under normal conditions.
- C5 (prd ¶1, ¶6): v1 scope is the core loop only; no feature beyond R1–R14 without a dated decision.
- C6 (decision 2026-11-23): The app is packaged and run with Docker, locally and in production.

## Done when

- In an unguided session, a first-time user creates, views, edits, completes and deletes a todo on desktop and on a phone, with no help.
- Every action can be completed with the keyboard alone, and a screen reader announces each control and each todo's status.
- A todo added, then completed, is still present with its status after a page refresh, a new browser session, and a server restart.
- The empty, loading and error states each appear when their condition is forced (no todos, slow API, API down), and the list stays usable after the error.
- The API refuses an invalid todo (empty or over-length description, on create or edit) with a clear error, shown by the client, and stores nothing.
- The app runs in production in Docker, from documented steps a new developer can follow to run, deploy and extend it.

## Boundaries

- Out in v1 (prd ¶6): user accounts and authentication, collaboration or sharing, task prioritization, deadlines or due dates, notifications.
- Out in v1 (assumed, see Notes): filtering or search, undo.
- Tracer path: a user adds a todo in the browser, the API stores it, and it is still in the list after a refresh.

## References

- prd — _bmad-output/initiative-todo-app/prd-todo-app.md, ¶1–¶7 (¶2 user actions and todo fields, ¶3 frontend experience, ¶4 API and persistence, ¶5 non-functional, ¶6 exclusions, ¶7 success measures)

## Notes

- Assumption: Completion is a toggle: a completed todo can be returned to active (prd ¶2 says only completion).
- Assumption: A description is required (non-empty after trimming) and capped at 200 characters to keep it short, on create and on edit.
- Assumption: The list is ordered by creation time, newest first.
- Assumption: Delete is immediate, with no confirmation dialog and no undo.
- Assumption: "Instantaneous" (C4) means the UI reflects an action within 100 ms and the API answers within 300 ms at p95 under single-user load.
- Open question: The stack beyond Docker (frontend, backend, storage) and the production host are not chosen yet. Waits: `bmad-architecture` and the opening epic.
- Decision: 2026-11-23, user: Editing a todo's text is in v1 (R13), replacing the assumption that it was out.
- Decision: 2026-11-23, user: One shared list per deployment is acceptable for v1.
- Decision: 2026-11-23, user: Docker packages and runs the app (C6). The rest of the stack is settled with the architect.
- Decision: 2026-11-23, user: Basic accessibility is in v1 (R14).
