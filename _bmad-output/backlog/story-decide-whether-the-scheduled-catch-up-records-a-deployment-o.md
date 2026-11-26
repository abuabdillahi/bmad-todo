---
id: 21
type: story
title: "Decide whether the scheduled catch-up records a deployment on every run"
after: []
refined: false
hitl: false
risk: low
tracker_id: "81"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/81"
tracker_status: backlog
---

# Decide whether the scheduled catch-up records a deployment on every run

## Description

Retrospective A13 (F10, D8): environment production on the catch-up job creates a GitHub deployment to production on every scheduled run, about 48 a day, and the Deployments view shows main's tip as active even when nothing deployed. deployment: false on catch-up would stop it; story 2.17 left it out on the user's instruction. A deploy-workflow setting: the user decides.

## Requirements

Verify: Notes hold the user's dated Decision; if it is deployment: false, a scheduled run that deploys nothing creates no deployment and the job-graph test pins the setting.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings F10 and D8; Action items A13

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A13).
- Decision: 2026-11-26, po (hands-off run on the user's instruction): the user decides this one, because it is a deploy-workflow setting the 2.17 build left out on the user's instruction.
- Open question: if #65 adds required reviewers or a wait timer to `production`, every half-hourly catch-up waits for approval; the user's answer on #65 (retrospective A17) bears on this one.
