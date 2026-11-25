---
id: 11
type: bug
title: "A shortened todo in an announcement can split a character"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "33"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/33"
tracker_status: backlog
---

# A shortened todo in an announcement can split a character

## Description

Announcer messages quote a todo's text, cut to 40 characters with "…" when it is longer (EXPERIENCE, Voice and Tone). The cut counts code points, not the characters a user sees, so a todo whose 40th code point falls inside an emoji sequence or a letter with a combining mark is shown and spoken with a broken character.

## Reproduction

1. Add a todo of 39 plain letters followed by a family emoji (a ZWJ sequence) and more text, so that it is longer than 40 characters.
2. Make the add fail (for example, take the API away), so the Announcer quotes it.
3. Actual: the quoted text ends in part of the emoji before "…". Expected: it ends on a whole character.

## Cause Hypothesis

The quote helper in the client's messages splits the text into code points and keeps the first 40, rather than splitting by grapheme.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R10 (deferred) and action item A6. It comes from the retrospective's own review, not from a story plan's triage log.
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Voice and Tone (the `{t}` rule)

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Where the finding pointed: `apps/web/src/todos/messages.ts:11-15`.
