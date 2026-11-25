---
id: 9
type: spike
title: "Does the add field behave as specified with a real Android keyboard?"
covers: []
after: []
assignee: ""
refined: false
hitl: true
risk: medium
tracker_id: "31"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/31"
tracker_status: backlog
---

# Does the add field behave as specified with a real Android keyboard?

## Description

The add field's Enter handling for composing keyboards was proven only with synthetic trusted keys in Chromium (story 1.8). Two review findings could not be settled without a real Android keyboard: whether Enter with `enterkeyhint="done"` arrives in a way that inserts a newline instead of submitting, and whether clearing the field after a successful add can rewrite the value while a composition is still open. Either, if true, would be medium. No ticket waits on the answer yet; epic-manage-todos' edit field will reuse the same text-field rules, so its refine should see the result. A person with a real Android phone runs the checks.

## Approach

To be settled at refine: the devices and keyboards to try (at least Gboard and one other), the cases (Enter while a word is composing, Enter after it is committed, an add followed at once by more typing), and the time box. The answer is recorded in this ticket's Notes, with a bug ticket for each failing case.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-a-todo-added-in-the-browser-is-still-there-after-a-refresh-t-plan.md, Review Triage Log #2 (maybe-false, deferred as medium, unverified)
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 follow-up review pass, finding 1 of 7 (maybe-false, deferred as medium, unverified)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings ("Real Android IME behaviour stays untested") and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field, and the accessibility table's expected Android behaviour

## Notes

- Decision: 2026-11-25, user: This untested risk moves to the backlog at epic-todo-foundation's closure (retrospective A6).
