---
id: 12
type: bug
title: "Dropping multi-line text into the add field loses Chrome's undo step"
covers: [R13, R14]
after: [4, 11]
assignee: ""
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "29"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/29"
tracker_status: backlog
parent: epic-manage-todos
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


## Acceptance Criteria

1. **One undo restores the field after a drop** (R13, R14)
   **Given** the add field or the edit field holds some text in Chrome
   **When** the user drops a selection of two or more lines of text into it, then presses Ctrl+Z (Cmd+Z on macOS) once
   **Then** the dropped text showed joined into one line with spaces, the caret sat after it, and the one undo restores the field exactly as it was before the drop, as one undo does after a paste
2. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails on the defect and passes on the fix drops multi-line text into each field and checks the joined text, the caret and the one undo, and the paste tests still pass
3. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** one undo already restores the field after a drop, with the evidence recorded in Notes; this supersedes 1 and 2

## Boundaries

- Must not change: paste handling, cleaning on `input`, the counter, or IME composition handling.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 review pass, finding 4 of 4 (rejected: real, more than a direct correction), carried in the follow-up pass
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Moved into epic-manage-todos as entry 12 (`tickets.py move`), ordered with the edit field as the user's 2026-11-25 Decision says: after story 4, which shares the text field between the add and edit fields, and after story 11, which changes the same field's input handling.
