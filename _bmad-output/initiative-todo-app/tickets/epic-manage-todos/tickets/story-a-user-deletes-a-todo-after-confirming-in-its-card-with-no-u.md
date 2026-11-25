---
id: 5
type: story
title: "A user deletes a todo after confirming in its card, with no undo"
parent: epic-manage-todos
covers: [R5, R7, R8, R11, R12, R14, R17]
after: [4]
hitl: false
risk: medium
tracker_id: "46"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/46"
tracker_status: backlog
---

# A user deletes a todo after confirming in its card, with no undo

## Description

The card's Delete button opens the inline Delete confirm ('Delete this todo?', Delete, Cancel), which sends nothing until confirmed; Cancel or Escape closes it; Confirm delete removes the row at once through AD-13's helper and story 2's DELETE, announces 'Deleted' on a 204 or 404, and a failed delete restores the row, flagged, with a message. Only one card is in edit mode or confirm at a time.

## Requirements

Verify: On the test profile: Delete on a todo shows 'Delete this todo?' and sends nothing; Cancel and Escape each close it and the todo stays; Delete in the confirm removes it at once, 'Deleted' shows, and it stays gone after a refresh. With the api stopped, the confirmed delete comes back flagged with a banner message.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: K4 whole; E3 whole; U5 delete part (a delete queued behind a pending create; a 404 is success); E6 delete part; K6 for Delete, Confirm delete and Cancel; E7 for E3; E8 for E3 and that E6 part (keyboard, axe-core in light and dark)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-6 (DELETE, 204, 404), AD-11 (the leaving row stays inert and aria-hidden for its exit motion only; a failed delete remounts the row fresh), AD-13 (404 on DELETE is success; Deleted on server confirmation), AD-14
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Delete confirm, Card buttons: Delete, Confirm delete, Cancel; Todo card: one card in edit mode or confirm at a time), State Patterns (Row states: Delete confirm, Leaving, Delete succeeded, Reverted after a failed delete, Confirm open todo vanishes on refetch, Failed add removes a card in use), Motion (Delete), Interaction Primitives (Focus management: Delete, Cancel, Confirm delete), Voice and Tone (delete lead, Deleted status); DESIGN.md Components (Delete confirm)
- initiative — _bmad-output/initiative-todo-app/initiative-todo-app.md: Notes, Decision 2026-11-24 (delete confirms inline in the card, no undo)

## Notes

- From 2.2's review (PR #53): the web client's `request()` calls `response.json()` on every success, so DELETE's `204` with no body would surface as a `generic` failure. This story's client handles a `204` with no body and sends no `Content-Type` on DELETE (Fastify answers an empty JSON-typed DELETE body with an undocumented `400`).
