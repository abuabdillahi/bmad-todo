---
id: 20
type: spike
title: "Does a multi-line drop keep one undo step in Firefox and Safari?"
after: []
hitl: true
risk: low
tracker_id: "80"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/80"
tracker_status: backlog
---

# Does a multi-line drop keep one undo step in Firefox and Safari?

## Description

Retrospective A12 (F8): story 2.12's guarded drop intercept was observed in Chromium and WebKit only; in Firefox a multi-line drop falls back to native-plus-clean, which may lose the single undo step. A person with Firefox (and Safari) drops two lines into the add and edit fields and presses undo once; any failure becomes a bug.

## Requirements

Verify: Notes record, per browser and field, whether one undo restores the field after a multi-line drop, with a bug named for each failure.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: finding F8; Action items A12

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A12).
- A person with a Firefox-capable host runs it: Playwright's Firefox would not launch on the build host (2.12 plan).
