---
id: 18
type: bug
title: "Failure announcements contradict the list when edits, completions and deletes of one todo overlap"
after: []
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "78"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/78"
tracker_status: backlog
---

# Failure announcements contradict the list when edits, completions and deletes of one todo overlap

## Description

Retrospective A10 (R3, R4, R7, R8): with a delete queued behind a failing edit, the lead says the todo is back while the row stays gone; a queued delete's 404 announces Deleted right after deleted elsewhere; a toggle undone at once with both PATCHes failing names the wrong verb; a failed delete re-inserts at a stale index. The final list state is right; the announcements and the restore slot are not. Also: the 15 s write abort is untested on PATCH, and the whole-character cut is untested for the edit, reopen, delete and add leads.

## Requirements

Verify: Unit tests for each overlap named in the Description pass with announcements that match the list, a reverted delete returns beside its neighbours, and the write-timeout and whole-character tests cover PATCH and every lead.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings R3, R4, R7, R8; Action items A10

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A10).
- Waits on 2.19 (#70) because: both change how the mutation helper and the add form handle calls mixed on one todo, and 2.19 adds the tests that pin the final list state.
