---
id: 4
type: story
title: "The add form cleans and checks a description before sending it"
parent: epic-todo-foundation
covers: [R1, R8, R12, R14, R17]
after: [3]
hitl: false
risk: medium
tracker_id: "7"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/7"
tracker_status: done
---

# The add form cleans and checks a description before sending it

## Description

The add field replaces line breaks, tabs and separators with spaces as they arrive, counts code points after the trim, refuses an empty or over-limit description inline with its spoken message, and sends exactly the checked value, using story 3's description.ts; it creates messages.ts with the inline field strings, which story 5 extends, and story 6 restores failed text into this field.

## Requirements

Verify: On the test profile: Add with an empty field shows 'Enter a description.' and adds nothing; pasting two lines shows them joined by a space and the counter counts them; past 200 characters the counter turns to its over state and Add adds nothing. The same holds by keyboard alone.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation.md
- test strategy — _bmad-output/initiative-todo-app/test-strategy.md: K1 validation, paste, counter and mid-text paste (caret and one undo) clauses; E6 add part 'an invalid description is refused with its message'; E8 for that state (keyboard, axe-core in light and dark)
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md: AD-8 (client side: replace, trim, check, send that exact value; inline, never through the announcer), AD-14 (the one hidden Field status for the add field)
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md: Component Patterns (Add form, Text field, Character counter, Inline error, Field status, Add button), Voice and Tone (Inline), State Patterns (Add form states: Rest, Typing, Over-limit, Empty submit), Interaction Primitives (Keyboard map, Pointer and touch, Focus management: Add invalid); DESIGN.md Components (Add form, Text field, counter, inline error)
