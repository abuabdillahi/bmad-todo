---
id: 10
type: bug
title: "A shortened todo in an announcement can split a character"
covers: [R7, R14]
after: []
assignee: ""
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "33"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/33"
tracker_status: in-progress
parent: epic-manage-todos
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


## Acceptance Criteria

1. **A quoted todo is cut on a whole character** (R7, R14)
   **Given** a todo longer than 40 characters whose 40th code point falls inside an emoji sequence (a ZWJ family, a flag, a skin-tone modifier) or a letter followed by combining marks
   **When** any Announcer message quotes it (a failed add, edit, complete, reopen or delete, "Added", "Deleted", or deleted elsewhere)
   **Then** the quoted text ends on a whole user-perceived character before "…", never on part of one
   **And** a todo of 40 characters or fewer is quoted whole, and plain text over 40 is still cut at 40 with trailing whitespace trimmed and "…" inside the closing quote (EXPERIENCE, Voice and Tone, `{t}`)
2. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a unit test that fails on the defect and passes on the fix covers each of those character kinds, and the existing quote cases still pass
3. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the quote already ends on a whole character, with the evidence recorded in Notes; this supersedes 1 and 2

## Boundaries

- Must not change: any message's wording, the 40-character limit, or where "…" goes.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md
- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Diff-scope review finding R10 (deferred) and action item A6. It comes from the retrospective's own review, not from a story plan's triage log.
- ux — _bmad-output/initiative-todo-app/ux-todo-app/EXPERIENCE.md, Voice and Tone (the `{t}` rule)

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog at epic-todo-foundation's closure (retrospective A6).
- Where the finding pointed: `apps/web/src/todos/messages.ts:11-15`.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Moved into epic-manage-todos as entry 10 (`tickets.py move`), ordered just before story 3, the first story whose messages quote todos on complete, reopen and delete, as the user's 2026-11-25 Decision in the epic's Notes says. It touches only the quote helper and its tests, so it can build beside stories 1 and 2.
- Decision: 2026-11-25, po (hands-off run on the user's instruction): Refined with full criteria. "40 characters" stays as EXPERIENCE says; a cut may keep fewer than 40 code points to end on a whole character, never more.
