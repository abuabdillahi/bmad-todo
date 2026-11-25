---
id: 6
type: story
title: "The list shows its empty, loading and error states, and recovers from a failed load"
parent: epic-manage-todos
covers: [R8, R9, R12, R14, R17]
after: [5]
hitl: false
risk: medium
tracker_id: "47"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/47"
tracker_status: backlog
---

# The list shows its empty, loading and error states, and recovers from a failed load

## Description

Renders AD-11's list states from epic 1's selector: the Empty panel, three skeleton cards with the Loading status and its recovery line, and the List error panel with its reason and Try again, with the focus moves and the hand-off order EXPERIENCE gives, so a first load that is slow, fails or recovers is shown and spoken; an early card keeps focus and an open Edit form or Delete confirm across the first successful load.

## Requirements

Verify: On the test profile: with no todos, 'No todos yet.' shows and adding one replaces it. Block /api/todos and reload: the error panel shows with its reason and Try again; unblock and press Try again: skeletons, then the list, and 'Your todos are loaded.' is spoken. All of it works by keyboard.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: K5 whole; E5 whole; E6 list error-state part (a failed first load shows the error panel, the list stays usable, Try again recovers); K6 for Try again; E8 for E5 and that E6 part (keyboard, axe-core in light and dark)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-11 (list state from the store, selector, query policy, Try again), AD-13 (settle-time refetch is Try again's fetch while a save is pending), AD-14 (the one Loading status and its recovery line)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Information Architecture (List area exceptions), Component Patterns (Empty panel, Skeleton card, Loading status, Recovery line, List error panel, Try again button), State Patterns (List states, all rows), Motion (skeleton breathing), Interaction Primitives (Focus management and Hand-off order for the list states), Voice and Tone (List error panel text, loading lines); DESIGN.md Components (Empty panel, Skeleton card, List error panel)
- epic — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md: Notes, Decision 2026-11-24 (AD-11 split: this epic renders the states and the Loading status from epic 1's selector)

## Notes

- From 2.3's review (PR #54), deferred to this story: when a toggle's `404` (deleted elsewhere) leaves the list empty while focus was in the row, `TodoCard.tsx` `toggle()` sends focus to the list's `<ul tabindex="-1">`, not EXPERIENCE's Empty panel (Focus management: an empty list sends focus to the Empty panel). This story retargets it to the Empty panel.
- From 2.3's review (PR #54), rejected there but in this story's area: a card toggled while its create is still pending, whose create then fails, disappears and leaves keyboard focus on the page body. Check it against EXPERIENCE's focus rules when the list's focus handling is built.
