---
id: 19
type: spike
title: "Does Flow 2 work with a real screen reader?"
after: []
hitl: true
risk: medium
tracker_id: "79"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/79"
tracker_status: backlog
---

# Does Flow 2 work with a real screen reader?

## Description

Retrospective A11 (F5): R14's screen-reader half of the manual pass is not done; the accessibility report leaves a dated pending line for the user's own check, and its A4 (Chromium joins the field's description parts without punctuation) waits on it. The user runs Flow 2 with TalkBack or a desktop screen reader; any failure becomes a bug.

## Requirements

Verify: Notes record, per screen reader and action of Flow 2, what was voiced, including the field's description parts, with a bug named for each failure; the accessibility report's pending line is answered.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: finding F5; Action items A11
- report — docs/quality/2026-11-25-epic-manage-todos-accessibility.md: A3, A4 and the pending screen-reader line

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A11).
- The user runs the check: no agent can drive a real screen reader (epic Notes, Decision 2026-11-25, po).
