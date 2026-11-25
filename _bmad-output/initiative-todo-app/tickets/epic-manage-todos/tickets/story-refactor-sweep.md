---
id: 7
type: story
title: "Refactor sweep"
parent: epic-manage-todos
after: [1, 2, 3, 4, 5, 6, 10, 11, 12]
hitl: false
risk: low
tracker_id: "48"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/48"
tracker_status: in-progress
---

# Refactor sweep

## Description

Cleanup only, its scope set at its start from the plans and review findings this epic deferred; scope pushed out of another story becomes a new story. It does not wait on the hitl spike 13.

## Requirements

Verify: pnpm test:all passes after the cleanup, and the story lists each deferred finding as fixed or moved to a named new story.

## References

- parent — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos.md

## Notes

- Decision: 2026-11-25, po (hands-off run on the user's instruction): The sweep waits on every entry except spike 13 (#31, the user's hitl check on a real phone) and the closing stories 8 and 9, which come after it so their reports measure the swept code, as in epic 1.
- From 2.4's review (PR #55), rejected there as cleanup: the rule that moves focus off a removed row exists in two copies (`TodoCard.tsx` and `TodoList.tsx`); fold them into one.
- From 2.4's review (PR #55), rejected there as low: the "deleted elsewhere" announcement dedupe compares the todo's text only, not its id.
