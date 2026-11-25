---
id: 4
type: story
title: "A user edits a todo's text in place, under the same rules as the add field"
parent: epic-manage-todos
covers: [R7, R8, R11, R12, R13, R14, R17]
after: [3]
hitl: false
risk: high
tracker_id: "45"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/45"
tracker_status: in-progress
---

# A user edits a todo's text in place, under the same rules as the add field

## Description

The card's Edit button swaps in the Edit form: a text field with the add field's cleaning, counter, inline error and Field status, shared with the add form rather than copied; Save or Enter commits through AD-13's helper and story 2's PATCH, Cancel or Escape discards, unchanged text sends nothing, and a failed save reverts with a message and keeps its draft for the next Edit. A todo deleted elsewhere while its row is in edit mode is announced. Stories 11 and 12 then fix the shared text field, and story 5 adds the rule that an edit and a confirm are never open together.

## Requirements

Verify: On the test profile: Edit a todo, change its text, press Enter: the new text shows at once and after a refresh. Edit again and press Escape: nothing changes. Save an empty field: 'Enter a description.' shows and nothing is sent. With the api stopped, Save reverts the text with a banner message, and the next Edit opens with the failed draft. The add form behaves exactly as before.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: K3 whole; E4 whole; U5 edit part; E6 edit part; K6 for Edit, Save and Cancel; E7 for E4; E8 for E4 and that E6 part (keyboard, axe-core in light and dark); K1 and E1 rerun unchanged for the add form
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-6 (PATCH { description }), AD-8 (client side on edit; inline, one Field status per text field; a server 400 after an optimistic edit is a mutation failure), AD-11, AD-13 (per-call promise keeps a failed edit's draft), AD-14 (deleted elsewhere from the list area)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Edit form, Text field, Character counter, Inline error, Field status, Card buttons: Edit, Save, Cancel; Completion check in edit mode), State Patterns (Row states: Edit, Edit invalid, Edit over-limit, Edit failed, Edit open todo vanishes on refetch, Edit open todo text changes on refetch), Interaction Primitives (Keyboard map, Focus management: Edit, Save, Cancel), Voice and Tone (edit lead); DESIGN.md Components (Edit form)

## Notes

- Check beyond the criteria (risk high): before review, the add form's existing K1, E1 and E6 add tests run unchanged and pass, and a reviewer edits a todo by keyboard alone at phone width in the dark scheme on the test profile.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The edit field shares the add field's text-field rules (cleaning, counter, inline error, Field status, Enter and composition handling) as one implementation, not a copy, so stories 11 and 12 fix both fields at once. Watch the add form's size (retrospective, God-class: `AddForm.tsx` was the largest source file).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Spike 13 (#31) does not gate this story: the 2026-11-24 order is reversed (epic Notes).
