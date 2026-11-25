---
id: 12
type: bug
title: "docker compose without -p uses the production project name"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
severity: P3
tracker_id: "34"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/34"
tracker_status: backlog
---

# docker compose without -p uses the production project name

## Description

Each environment runs under its own compose project name (C7, AD-16): `todo-dev`, `todo-test` and `todo` for production. The names come only from the `-p` flag that every script and the README pass. Running `docker compose` without `-p` in a checkout folder named `todo` uses the project name `todo`, the production one, so a forgotten flag can act on production's containers and volume wherever that project runs.

## Reproduction

1. In a checkout folder named `todo`, run `docker compose --profile dev up -d` with no `-p`.
2. Actual: the project is named `todo`, the production project's name. Expected: a command with no `-p` cannot land on the production project.

## Cause Hypothesis

`compose.yml` has no top-level `name:`, so Compose falls back to the folder name. The file's header documents the `-p` for each environment, but nothing enforces it.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Spec-to-implementation finding F6 (deferred, low). It comes from the retrospective, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-16 (one project name per environment) and AD-18 (the deploy runs `-p todo`)

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog after epic-todo-foundation's closure.
- Where the finding pointed: `compose.yml:1-4`.
