---
id: 7
type: bug
title: "Dropping multi-line text into the add field loses Chrome's undo step"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "29"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/29"
tracker_status: backlog
---

# Dropping multi-line text into the add field loses Chrome's undo step

## Description

A paste of multi-line text into the add field is joined into one line and one undo restores the field, as EXPERIENCE.md's Text field pattern asks. A drag-and-drop of the same text is also joined, but in Chrome the user can no longer undo it.

## Reproduction

1. In Chrome, open the app and type some text into the add field.
2. Drag a selection of two lines of text from another page and drop it into the field.
3. Press Ctrl+Z (Cmd+Z on macOS).
4. Actual: the drop is not undone. Expected: one undo restores the field as before the drop, as it does after a paste.

## Cause Hypothesis

Paste is cleaned on the `paste` event, but a drop is cleaned on the input path after the browser has inserted it; rewriting the value there replaces the browser's undo entry. EXPERIENCE.md describes cleaning on `beforeinput`.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 review pass, finding 4 of 4 (rejected: real, more than a direct correction), carried in the follow-up pass
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
