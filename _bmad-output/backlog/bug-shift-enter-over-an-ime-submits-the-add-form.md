---
id: 8
type: bug
title: "Shift+Enter over an IME submits the add form"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "30"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/30"
tracker_status: backlog
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

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/tickets/story-the-add-form-cleans-and-checks-a-description-before-sending-plan.md, Review Triage Log, 2026-11-25 follow-up review pass, finding 2 of 7 (rejected: real, more than a direct correction)
- retrospective — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, rejected-but-real findings and action item A6
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Component Patterns, Text field

## Notes

- Decision: 2026-11-25, user: This rejected-but-real finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Open question: Reproducing it needs a real IME or Android keyboard; the spike on real Android keyboards (backlog id 9, #31) may confirm it on the way.
