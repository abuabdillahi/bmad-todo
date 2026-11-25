---
id: 11
type: bug
title: "Shift+Enter over an IME submits the add form"
covers: [R13, R14]
after: [4]
assignee: ""
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "30"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/30"
tracker_status: in-progress
parent: epic-manage-todos
---

# Shift+Enter over an IME submits the add form

## Description

Shift+Enter in the add field should do nothing. When the keyboard is an IME, or an Android keyboard that reports Enter as a composing key, Shift+Enter submits the form instead.

## Reproduction

1. With a hardware keyboard and an IME active (or an Android keyboard that sends Shift+Enter), type text into the add field.
2. Press Shift+Enter.
3. Actual: the todo is added. Expected: nothing happens, as with Shift+Enter on a plain keyboard.

## Cause Hypothesis

After a composing (keyCode 229) keydown, the browser sends `beforeinput` with `insertLineBreak`, which the form treats as a submit. That event does not carry Shift, and the keydown state is not kept, so the handler cannot tell Shift+Enter from Enter.


## Acceptance Criteria

1. **Shift+Enter never submits or inserts a line break** (R13, R14)
   **Given** the add field or the edit field holds text, with an IME or a composing keyboard (keydown reported as composing, keyCode 229)
   **When** the user presses Shift+Enter
   **Then** nothing is submitted and no line break or space is inserted, in either field, as with Shift+Enter on a plain keyboard
   **And** Enter alone still submits the add form or saves the edit, also when the keyboard keeps every word composing (EXPERIENCE, Component Patterns, Text field), and Enter during an open composition still does not submit
2. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test with trusted composing keys in Chromium (as story 1.8's test drives them) fails on the defect and passes on the fix, for the add field and the edit field, and the existing Enter tests still pass
3. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** Shift+Enter over a composing keyboard already submits nothing, with the evidence recorded in Notes; this supersedes 1 and 2

## Boundaries

- Must not change: Enter submitting, paste and drop cleaning, the counter and the Field status, or Tab moving focus.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 follow-up review pass, finding 2 of 7 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Moved into epic-manage-todos as entry 11 (`tickets.py move`), ordered right after story 4, the edit field, as the user's 2026-11-25 Decision says. Story 4 shares the add field's text-field rules with the edit field, so this fix lands once and covers both fields.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): The open question above is settled: the fix is proven with trusted composing keys in Chromium; spike 13 (#31), run by the user on a real phone after this ships, confirms it on real keyboards and files a new bug if it does not hold.
