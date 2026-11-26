---
id: 15
type: bug
title: "A re-run scheduled deploy can skip its health check or miss a rollback"
after: []
refined: false
hitl: false
risk: high
severity: P2
tracker_id: "75"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/75"
tracker_status: backlog
---

# A re-run scheduled deploy can skip its health check or miss a rollback

## Description

Retrospective A7 (D3, D6, D7): re-running a failed scheduled run reuses attempt 1's CHECKED SHA, so the deploy's guard can take its skip branch after attempt 1 already deployed the tip and go green with no health check; and catch-up-gate reads the current attempt's start, so a rollback that finished between attempts is not seen. Also to decide: whether a rollback by hand must name a SHA on main, and how the catch-up behaves after a long SSH outage (failed scheduled runs pile up for one tip). Touches the deploy job's steps: the user decides.

## Requirements

Verify: A re-run of a failed scheduled run either deploys and health-checks the tip or skips with a notice, and never deploys over a rollback that ran between attempts, shown by the job-graph and catch-up tests; the user's answers on rollback SHAs and SSH outages are dated Decisions in Notes.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings D3, D6, D7; Action items A7

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A7).
- Decision: 2026-11-26, po (hands-off run on the user's instruction): the user decides this one, because it changes the deploy job's steps, which the epic's Notes reserve to the user (Decision 2026-11-25, po). No build starts until the user has answered the two questions in the Description.
- Waits on 2.20 (#71) and 2.21 (#72) because: 2.20 pins the gate's wiring this fix changes, and 2.21 writes the README's warning against re-running a scheduled run, which this fix revises.
- Risk high: a wrong fix deploys over a rollback or leaves production unchecked, and a broken deploy job is seen only on main. Beyond the criteria, check on main after merge that a push run and the next scheduled run both behave as before.
