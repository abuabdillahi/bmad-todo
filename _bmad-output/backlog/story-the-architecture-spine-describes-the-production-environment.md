---
id: 16
type: story
title: "The architecture spine describes the production environment, dispatch-off-main and the write timeouts"
after: []
hitl: false
risk: medium
tracker_id: "76"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/76"
tracker_status: backlog
---

# The architecture spine describes the production environment, dispatch-off-main and the write timeouts

## Description

Retrospective A8 (F1, F11, R5): AD-18 still describes one workflow with test and deploy only, without #27's dispatch-off-main job or #64's `environment: production` on deploy; the Deferred line on a write that may have landed still says a resubmit mints a new id (story 2.1 made an unchanged resubmit reuse it); AD-4 and AD-13 do not record nginx's 10 s proxy_read_timeout for /api or the client's 15 s write abort. Amended through bmad-architecture with the user's consent.

## Requirements

Verify: The spine's AD-18 names dispatch-off-main and deploy's environment production; its Deferred line records the id reuse and the follow-up case; AD-4 and AD-13 state the 10 s and 15 s limits; each change cites its story.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings F1, F11, R5; Decision records; Action items A8

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A8).
- Decision: 2026-11-26, po (hands-off run on the user's instruction): the user decides this one, because it amends the architecture spine, which changes only through `bmad-architecture` with the user's consent; the retrospective's three proposed decision records may be folded into it.
- Decision: 2026-11-26, po on the user's instruction (check, simplify and close epic-manage-todos): the catch-up parts are removed from this ticket, since PR #87 removed the scheduled catch-up; AD-18 needs only dispatch-off-main and deploy's environment production. Title and Description changed to match.
