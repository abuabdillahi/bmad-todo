---
title: 'docker compose without -p uses the production project name'
type: bugfix
ticket: '12'
created: '2026-11-25'
status: draft
baseline_revision: ''
route: ''
route_source: ''
risk: ''
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `compose.yml` has no top-level `name:`, so a `docker compose` command run with no `-p` (and no `COMPOSE_PROJECT_NAME`) in a folder named `todo` falls back to the folder name, `todo`, which is production's project (C7, AD-16). Reproduced on ab75e89: `compose.yml` copied into a scratch folder `…/todo/`, `docker compose config --format json` with `COMPOSE_PROJECT_NAME` unset reports `"name": "todo"`.

**Approach:** Per the ticket's Decision of 2026-11-25 (user), a command with no project name refuses to run: give `compose.yml` a top-level `name: ${COMPOSE_PROJECT_NAME:?<message naming -p todo-dev, -p todo-test and -p todo>}`, so Compose fails at interpolation before it touches any container, while `-p` (from which Compose sets `COMPOSE_PROJECT_NAME`) and an explicit `COMPOSE_PROJECT_NAME` still resolve to exactly that name. A first build defaulted to `name: todo-dev` and was reverted at review (a forgotten `-p` on the host would start a second `cloudflared` over an empty database; a test reset would delete dev data); its saved patch `bug-docker-compose-without-p-uses-the-production-project-name-plan.patch` (in git history at c3d9cbd) holds a reusable `docker compose config` profile test, whose no-`-p` case now expects a refusal and whose child env must also drop `COMPOSE_ENV_FILES` and `COMPOSE_PROFILES`. Every compose command the repository runs (scripts, tests, the workflow) must already pass a project name; `.env.example` and the README change only where they describe the project names or a command with no `-p`.

</intent-contract>

## Plan Change Log

- 2026-11-25, orchestrator: Re-opened from `blocked` as `draft` after the user chose option (a) for the intent gap recorded in this plan's first Review Triage Log (commit c3d9cbd). The Approach is amended to match; the ticket's criteria 1-3 and its Boundaries were amended on main (e40d8eb). The first run's baseline, review and deferred fields are cleared; its two deferred items were written for the `todo-dev` default and no longer apply as written.
