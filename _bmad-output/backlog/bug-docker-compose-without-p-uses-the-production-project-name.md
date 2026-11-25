---
id: 12
type: bug
title: "docker compose without -p uses the production project name"
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
severity: P3
tracker_id: "34"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/34"
tracker_status: in-progress
---

# docker compose without -p uses the production project name

## Description

Each environment runs under its own compose project name (C7, AD-16): `todo-dev`, `todo-test` and `todo` for production. The names come only from the `-p` flag that every script and the README pass. Running `docker compose` without `-p` in a checkout folder named `todo` uses the project name `todo`, the production one, so a forgotten flag can act on production's containers and volume wherever that project runs.

## Reproduction

1. In a checkout folder named `todo`, run `docker compose --profile dev up -d` with no `-p`.
2. Actual: the project is named `todo`, the production project's name. Expected: a command with no `-p` cannot land on the production project.

## Cause Hypothesis

`compose.yml` has no top-level `name:`, so Compose falls back to the folder name. The file's header documents the `-p` for each environment, but nothing enforces it.

## Acceptance Criteria

1. **A command with no project name never uses the production project** (C7; AD-16)
   **Given** a checkout, or the host's `~/todo`, in a folder named `todo`, with no `-p` and no `COMPOSE_PROJECT_NAME` set
   **When** a person runs any `docker compose` command there
   **Then** the project it uses is not `todo`, so it cannot touch production's containers or volume
2. **Every named environment still uses its own project** (AD-16, AD-18)
   **Given** the documented commands with `-p todo-dev`, `-p todo-test` and `-p todo`
   **When** each runs
   **Then** it uses exactly that project, `pnpm test:all` passes, and the deploy's commands need no change
3. **A check guards it**
   **Given** the test suite
   **When** `pnpm test:all` runs
   **Then** an automated check fails if `compose.yml` would fall back to the project name `todo` when no project is given, and passes on the fix
4. **Production deploys as before**
   **Given** the fix is merged to `main`
   **When** the deploy job runs
   **Then** it succeeds, and `/api/health` on the public hostname answers `200`
5. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the project is already not `todo`, with the evidence recorded in Notes; this supersedes 1–4

## Boundaries

- Must not change: the three project names (`todo-dev`, `todo-test`, `todo`), the deploy job's commands, or production's volume. No compose command is run by hand against project `todo`; the deploy job's own run after the merge is the only one.
- Must not change: `README.md` or `.env.example`; ticket #25 edits them in parallel. If a line about running with no `-p` is wanted, record it as a deferred item in the plan.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Spec-to-implementation finding F6 (deferred, low). It comes from the retrospective, not from a story plan's triage log.
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-16 (one project name per environment) and AD-18 (the deploy runs `-p todo`)

## Notes

- Decision: 2026-11-25, user: This deferred finding moves to the backlog after epic-todo-foundation's closure.
- Where the finding pointed: `compose.yml:1-4`.
