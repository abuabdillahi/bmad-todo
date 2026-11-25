---
id: 3
type: story
title: "A user completes and reactivates a todo, and a completed todo looks done"
parent: epic-manage-todos
covers: [R4, R6, R7, R8, R11, R12, R14, R17]
after: [1, 2, 10]
hitl: false
risk: medium
tracker_id: "44"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/44"
tracker_status: in-progress
---

# A user completes and reactivates a todo, and a completed todo looks done

## Description

Tracer bullet: the card's completion check and Done chip, styled done in light and dark, toggle completed at once through AD-13's helper and story 2's PATCH, persist after a refresh, and revert with a message and the revert flag when saving fails; a 404 on a toggle says the todo was deleted elsewhere. It speaks messages.ts's complete, reopen and deleted-elsewhere messages, quoted by story 10's fixed quote, and adds AD-20's per-test list reset through the public API's DELETE in every e2e spec (retrospective F3), using story 1's shared e2e helpers.

## Requirements

Verify: On production, tick a todo: at once it shows done (the Done chip, receded text) in light and dark, it is still done after a refresh, and unticking makes it active again. On the test profile with the api stopped, ticking reverts with the banner saying the change failed, and the list stays usable.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: U3 whole; K2 whole; E2 whole; U5 complete part; E6 complete and reopen part (failing and unreachable revert with a message, list usable); K6 for the completion check; E7 for E2; E8 for E2 and that E6 part (keyboard, axe-core in light and dark)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-6 (PATCH { completed }), AD-11 (no re-sort; a row a refetch removes unmounts at once), AD-13 (the helper, revert records, revertedAt), AD-14 (deleted elsewhere from the list area), AD-20 (each e2e test empties the list through the public API in beforeEach)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Todo card, Completion check, Done chip), State Patterns (Row states: Active / Done, Saving, Reverted, Not found), Motion (revert flag), Interaction Primitives (Focus management: Completion check, Not found), Voice and Tone (complete and reopen leads, deleted elsewhere); DESIGN.md Components (Todo card states, Completion check, Done chip, revert flag) in light and dark

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): This is the epic's tracer bullet: the thinnest path through every layer the epic touches (card, helper, API client, PATCH, service, SQLite, deploy). Stories 1 (the user's 2026-11-25 Decision) and 2 (the routes it calls) come first.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): AD-20's per-test reset lands here: each e2e test empties the list through the public API (`GET` then `DELETE` each todo) in `beforeEach`, replacing epic 1's reliance on unique descriptions alone (retrospective F3), using story 1's shared helpers.
