---
id: 22
type: story
title: "Build review depth follows ticket risk"
after: []
refined: false
hitl: false
risk: medium
tracker_id: "82"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/82"
tracker_status: backlog
---

# Build review depth follows ticket risk

## Description

Retrospective A14 (P1, P5; previous retrospective A8): .claude/skills/bmad-build-auto/customize.toml pins review = quick, and the auto setting maps the oneshot route to quick, so medium-risk 2.16 and 2.17, both changing ci.yml, got one quick lens. Medium and high tickets should get the thorough lenses whatever their route, and a high patched in the last allowed pass one fresh review before merge. A customize.toml change or an orchestrator rule: the user chooses.

## Requirements

Verify: A medium-risk ticket on the oneshot route is reviewed with the thorough lenses, and the rule for a late high is written where the build or the orchestrator reads it.

## References

- retrospective — _bmad-output/initiative-todo-app/tickets/epic-manage-todos/epic-manage-todos-retrospective.md: findings P1 and P5; Previous-retro follow-through (A8); Action items A14

## Notes

- Decision: 2026-11-26, po (hands-off run on the user's instruction): deferred to the backlog by epic-manage-todos' retrospective (action item A14).
