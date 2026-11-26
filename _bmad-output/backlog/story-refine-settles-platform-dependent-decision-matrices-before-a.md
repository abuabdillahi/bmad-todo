---
id: 23
type: story
title: "Refine settles platform-dependent decision matrices before a high-risk build"
after: []
refined: false
hitl: false
risk: low
tracker_id: "83"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/83"
tracker_status: dropped
---

# Refine settles platform-dependent decision matrices before a high-risk build

## Description

Retrospective A15 (P5): bug 2.15 reached review before its decision matrix on GitHub's concurrency groups, skip tokens and cancellations was settled, halted on an intent gap, and needed a po Decision and a re-plan. Refining a high-risk ticket whose behaviour rests on a platform's semantics should settle that matrix first.

## Requirements

Verify: The refine guidance the po follows names the check, and the next high-risk CI or platform ticket's Notes show its matrix settled before its build starts.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: finding P5; Action items A15

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A15).
- Dropped: 2026-11-26, po on the user's instruction (check, simplify and close epic-manage-todos): process-only: it changes how agents build and review, not the product, and the user stopped the hands-off run; it stays recorded as epic-manage-todos' retrospective action item A15, with no ticket.
