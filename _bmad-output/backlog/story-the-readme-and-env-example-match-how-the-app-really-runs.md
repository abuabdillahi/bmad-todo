---
id: 3
type: story
title: "The README and .env.example match how the app really runs"
covers: []
after: []
assignee: ""
refined: true
hitl: false
risk: low
tracker_id: "25"
remote: "https://github.com/abuabdillahi/bmad-todo/issues/25"
tracker_status: done
---

# The README and .env.example match how the app really runs

## Description

Four statements a new developer relies on are wrong or missing. `APP_ENV` is required by the API's config but changes nothing, while `.env.example` says it "changes log formatting only": either use it or drop the requirement and the claim. The README asks for "Docker with Compose v2", but `compose.yml` uses `profiles: !override` and `start_interval`, which need Compose 2.24.4 and Engine 25 or later. The README says the API logs one JSON line per request; Fastify writes two ("incoming request" and "request completed"). The README's rollback section does not say that re-running a failed deploy more than a day later fails, because the tested images are kept as artifacts for one day.

## Requirements

1. **`.env.example` says what `APP_ENV` does** (AD-16)
   **Given** `.env.example`
   **When** a reader looks up `APP_ENV`
   **Then** it says the API requires one of `development`, `test` or `production` and refuses to start otherwise, and that no behaviour depends on it in v1. It no longer says it changes log formatting.
2. **The README names the Docker versions the compose file needs** (AD-16)
   **Given** the README's prerequisites
   **When** a reader checks what to install
   **Then** they name Docker Compose 2.24.4 or later and Docker Engine 25 or later, and what in `compose.yml` needs them
3. **The README describes the request log lines as they are** (AD-17)
   **Given** the README's "Logs and health" section
   **When** a reader compares it with the `api` logs of one request
   **Then** it says each request writes two JSON lines, "incoming request" and "request completed", with the same `reqId`. The claim about todo text still matches what the logs prove.
4. **The README says what still works after a day** (AD-18)
   **Given** the README's "Deploy" and "Roll back" sections
   **When** a reader needs to re-run a failed deploy, or roll back to an earlier SHA, more than a day after that SHA's test run
   **Then** the README says that a rollback by hand still works, because it pulls the images from GHCR and skips the artifact, and that re-running a failed push deploy fails after a day, because the tested images are kept as artifacts for one day, with what to do instead. Both are checked against the workflow.
5. **Every claim is checked against the repository**
   **Given** the edited text
   **When** the plan's verification runs
   **Then** each of criteria 1–4 is checked against the code, `compose.yml`, the workflow or a real log, and the plan records how

## Boundaries

- Must not change: anything outside `README.md` and `.env.example`. No code, `compose.yml`, workflow or architecture change; `APP_ENV` stays required (see Notes).

## References

- source — _bmad-output/initiative-todo-app/tickets/epic-todo-foundation/epic-todo-foundation-retrospective.md, Findings R5, R6, R7, R8 and action item A5
- architecture — _bmad-output/initiative-todo-app/architecture-todo-app/architecture-todo-app.md, AD-16 (environments), AD-17 (logs) and AD-18 (deploy and rollback)

## Notes

- Decision: 2026-11-25, user: Retrospective action A5 gets its own backlog ticket at epic-todo-foundation's closure.
- Decision: 2026-11-25, user: Keep `APP_ENV` and correct the claim about it. AD-16 already requires it and allows only log formatting to depend on it, so the as-built code meets AD-16 and only `.env.example` is wrong. Dropping it would need an AD-16 amendment and would touch `compose.yml`, the workflow and the test runner, which other tickets are changing in parallel.
- Where the finding pointed: `apps/api/src/config.ts:35-38`, `.env.example:9`, `compose.yml:59,69`, `.github/workflows/ci.yml:78` (`retention-days: 1`), README "Logs and health" and "Roll back". The retrospective also deferred a test for the error-path log lines (R8); it is not part of this ticket.
