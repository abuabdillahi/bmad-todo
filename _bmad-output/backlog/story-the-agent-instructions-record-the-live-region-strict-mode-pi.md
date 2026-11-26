---
id: 24
type: story
title: "The agent instructions record the live-region strict-mode pitfall"
after: []
hitl: false
risk: low
tracker_id: "84"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/84"
tracker_status: backlog
---

# The agent instructions record the live-region strict-mode pitfall

## Description

Retrospective A16 (P7; previous retrospective A9): AGENTS.md has only its Git section; the strict-mode pitfall (text shown in a visible element and in a frame-delayed live region makes a text locator match twice) is not recorded. Added through bmad-project-context.

## Requirements

Verify: AGENTS.md (or the file it points agents to) names the pitfall and the fix used in e2e/helpers.ts (announcement() excludes the Field status).

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: finding P7; Previous-retro follow-through (A9); Action items A16

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A16).
