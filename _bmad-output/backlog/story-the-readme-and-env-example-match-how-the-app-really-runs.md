---
id: 3
type: story
title: "The README and .env.example match how the app really runs"
covers: []
after: []
assignee: ""
refined: false
hitl: false
risk: low
tracker_id: "25"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/25"
tracker_status: backlog
---

# The README and .env.example match how the app really runs

## Description

Four statements a new developer relies on are wrong or missing. `APP_ENV` is required by the API's config but changes nothing, while `.env.example` says it "changes log formatting only": either use it or drop the requirement and the claim. The README asks for "Docker with Compose v2", but `compose.yml` uses `profiles: !override` and `start_interval`, which need Compose 2.24.4 and Engine 25 or later. The README says the API logs one JSON line per request; Fastify writes two ("incoming request" and "request completed"). The README's rollback section does not say that re-running a failed deploy more than a day later fails, because the tested images are kept as artifacts for one day.

## Requirements

Verify: a reader can check each of the four in the repository: `APP_ENV` either changes observable behaviour as `.env.example` describes or is no longer required or claimed; the README names Compose 2.24.4 and Engine 25 as minimums; it describes the two log lines per request; and its rollback section states the one-day artifact limit on re-running a deploy.

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Findings R5, R6, R7, R8 and action item A5
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-16 (environments), AD-17 (logs) and AD-18 (deploy and rollback)

## Notes

- Decision: 2026-11-25, user: Retrospective action A5 gets its own backlog ticket at epic-todo-foundation's closure.
- Open question: Use `APP_ENV` or drop it? Answered in the work; whichever is chosen, AD-16 must still hold.
- Where the finding pointed: `apps/api/src/config.ts:35-38`, `.env.example:9`, `compose.yml:59,69`, `.github/workflows/ci.yml:78` (`retention-days: 1`), README "Logs and health" and "Roll back". The retrospective also deferred a test for the error-path log lines (R8); it is not part of this ticket.
